import { ConstellationConfig } from '../config/config.js';

/**
 * MCP Tool Result interface matching client-api response format
 */
export interface McpToolResult<T = any> {
	/** Whether the tool execution succeeded */
	success: boolean;
	/** Result data (only present on success) */
	data?: T;
	/** Error message (only present on failure) */
	error?: string;
	/** Execution metadata */
	metadata: {
		toolName: string;
		executionTime: number;
		cached: boolean;
		timestamp: string;
		[key: string]: any;
	};
}

/**
 * Client for communicating with the Constellation central service.
 * Adapted from CLI for MCP server use - focuses on MCP tool execution.
 */
export class ConstellationClient {
	/**
	 * API version for use in versioned endpoint paths
	 */
	private readonly apiVersion = 'v1';

	/** HTTP status codes that should trigger retry logic */
	private retryableStatusCodes: number[] = [500, 502, 503, 504];

	/**
	 * Creates a new ConstellationClient instance.
	 * @param config Configuration settings for API connection
	 * @param accessKey API access key for authentication
	 */
	constructor(
		private config: ConstellationConfig,
		private accessKey: string,
	) {}

	/**
	 * Execute an MCP tool via the Constellation API.
	 *
	 * @param toolName Name of the MCP tool to execute
	 * @param parameters Tool-specific input parameters
	 * @param context Execution context (project ID, branch name)
	 * @returns Tool execution result
	 * @throws Error if tool execution fails
	 */
	async executeMcpTool<TParams = any, TResult = any>(
		toolName: string,
		parameters: TParams,
		context: { projectId: string; branchName: string },
	): Promise<McpToolResult<TResult>> {
		try {
			const response = await this.sendRequest(
				`mcp/tools/${toolName}`,
				{ parameters },
				'POST',
				{
					'x-project-id': context.projectId,
					'x-branch-name': context.branchName,
				},
			);

			// Handle 404 - tool not found
			if (response?.status === 404) {
				throw new ToolNotFoundError(
					`Tool "${toolName}" not found. Check API catalog for available tools.`,
				);
			}

			// Parse response body
			if (!response?.ok) {
				const errorText = await response.text();
				throw new Error(
					`MCP tool "${toolName}" failed: ${response.statusText} (${response.status})\n${errorText}`,
				);
			}

			const result = (await response.json()) as McpToolResult<TResult>;
			return result;
		} catch (error: any) {
			// Re-throw known errors
			if (
				error instanceof ToolNotFoundError ||
				error instanceof AuthenticationError ||
				error instanceof AuthorizationError ||
				error instanceof NotFoundError
			) {
				throw error;
			}

			// Wrap unexpected errors
			throw new Error(
				`Failed to execute MCP tool "${toolName}": ${error.message}`,
				{ cause: error },
			);
		}
	}

	/**
	 * Get the MCP tool catalog from the API.
	 *
	 * @param query Optional query parameters for filtering
	 * @returns Tool catalog with available tools
	 */
	async getToolCatalog(query?: {
		category?: string;
		search?: string;
		tags?: string[];
		includeDeprecated?: boolean;
	}): Promise<any> {
		const params = new URLSearchParams();

		if (query?.category) params.append('category', query.category);
		if (query?.search) params.append('search', query.search);
		if (query?.tags) params.append('tags', query.tags.join(','));
		if (query?.includeDeprecated) params.append('includeDeprecated', 'true');

		const queryString = params.toString();
		const path = queryString ? `mcp/catalog?${queryString}` : 'mcp/catalog';

		const response = await this.sendRequest(path, undefined, 'GET');

		if (!response?.ok) {
			throw new Error(`Failed to fetch tool catalog: ${response?.statusText}`);
		}

		return response.json();
	}

	/**
	 * Get metadata for a specific tool.
	 *
	 * @param toolName Name of the tool
	 * @returns Tool metadata including schema
	 */
	async getToolMetadata(toolName: string): Promise<any> {
		const response = await this.sendRequest(
			`mcp/tools/${toolName}`,
			undefined,
			'GET',
		);

		if (response?.status === 404) {
			throw new ToolNotFoundError(`Tool "${toolName}" not found`);
		}

		if (!response?.ok) {
			throw new Error(`Failed to fetch tool metadata: ${response?.statusText}`);
		}

		return response.json();
	}

	/**
	 * Sends an HTTP request with retry logic and timeout handling.
	 *
	 * @param path API endpoint path (without base URL or version)
	 * @param data Request body data
	 * @param method HTTP method (GET, POST, DELETE)
	 * @param additionalHeaders Additional request headers
	 * @param timeout Request timeout in milliseconds (0 for no timeout)
	 * @param retries Number of retry attempts
	 * @param delay Base delay between retries in milliseconds
	 * @param jitter Random jitter added to delay to prevent thundering herd
	 * @returns HTTP Response object
	 * @throws Error on non-retryable failures or after exhausting retries
	 */
	private async sendRequest(
		path: string,
		data: any,
		method: string,
		additionalHeaders: Record<string, string> = {},
		timeout = 30000, // 30 second default timeout
		retries = 3,
		delay = 1000,
		jitter = 250,
	): Promise<Response> {
		for (let i = 1; i <= retries; i++) {
			try {
				const controller = new AbortController();
				let timeoutTimer: NodeJS.Timeout | undefined;

				if (timeout > 0) {
					timeoutTimer = setTimeout(() => controller.abort(), timeout);
				}

				const requestHeaders: Record<string, string> = {
					...additionalHeaders,
					'Content-Type': 'application/json; charset=utf-8',
					Accept: 'application/json; charset=utf-8',
					Authorization: `Bearer ${this.accessKey}`,
				};

				const url = `${this.config.apiUrl}/${this.apiVersion}/${path}`;

				const response = await fetch(url, {
					method,
					headers: requestHeaders,
					body: data ? JSON.stringify(data) : undefined,
					signal: controller.signal,
				});

				if (timeoutTimer) {
					clearTimeout(timeoutTimer);
				}

				// Handle authentication errors (401)
				if (response.status === 401) {
					throw new AuthenticationError(
						'Authentication failed. Check your CONSTELLATION_ACCESS_KEY environment variable.',
					);
				}

				// Handle authorization errors (403)
				if (response.status === 403) {
					throw new AuthorizationError(
						'Authorization failed. Your access key does not have permission for this operation.',
					);
				}

				// Check if we should retry
				if (
					!response.ok &&
					this.retryableStatusCodes.includes(response.status)
				) {
					throw new RetryableError(
						`${response.statusText} (${response.status})`,
					);
				}

				return response;
			} catch (error: any) {
				const errorDetails =
					error instanceof Error
						? `${error.message}${error.cause ? ` (Cause: ${error.cause})` : ''}`
						: String(error);

				// Log retry attempts (only in debug mode)
				if (process.env.DEBUG) {
					console.error(
						`HTTP request attempt ${i}/${retries} failed: ${errorDetails}`,
					);
				}

				// Only retry RetryableError, everything else gets thrown immediately
				if (i < retries && error instanceof RetryableError) {
					// FIX SB-90: Exponential backoff: delay * 2^(attempt-1) = 1s, 2s, 4s, etc.
					const backoffDelay = delay * Math.pow(2, i - 1);
					// Add jitter to prevent thundering herd
					const jitteredDelay =
						backoffDelay + Math.floor(Math.random() * jitter);
					// Cap maximum delay at 30 seconds
					const cappedDelay = Math.min(jitteredDelay, 30000);
					await new Promise((resolve) => setTimeout(resolve, cappedDelay));
				} else {
					throw error;
				}
			}
		}

		// Should never reach here, but TypeScript needs it
		throw new Error('Maximum retries exceeded');
	}
}

/**
 * Error thrown for server issues that can be retried (5xx status codes).
 */
export class RetryableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RetryableError';
	}
}

/**
 * Error thrown when authentication fails (401 status code).
 */
export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthenticationError';
	}
}

/**
 * Error thrown when resource is not found (404 status code).
 * Indicates that the project has not been indexed yet or tool doesn't exist.
 */
export class NotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}

/**
 * Error thrown when a tool is not found.
 */
export class ToolNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ToolNotFoundError';
	}
}

/**
 * Error thrown when authorization fails (403 status code).
 * Indicates valid credentials but insufficient permissions.
 */
export class AuthorizationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthorizationError';
	}
}

/**
 * Error thrown when configuration is missing or invalid.
 */
export class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationError';
	}
}

/**
 * Error thrown when a timeout occurs.
 */
export class TimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TimeoutError';
	}
}
