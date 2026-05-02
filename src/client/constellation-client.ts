import { ConstellationConfig } from '../config/config.js';
import type { McpToolResult } from '../types/mcp-response.js';

/** Default HTTP request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/** Default number of retry attempts for failed requests */
const DEFAULT_RETRIES = 3;

/** Base delay between retries in milliseconds (before exponential backoff) */
const DEFAULT_RETRY_DELAY_MS = 1000;

/** Maximum random jitter added to retry delay in milliseconds */
const DEFAULT_RETRY_JITTER_MS = 250;

/** Maximum total retry delay in milliseconds (cap for exponential backoff) */
const MAX_RETRY_DELAY_MS = 30000;

/**
 * Client for communicating with the Constellation central service.
 * Adapted from CLI for MCP server use - focuses on MCP tool execution.
 */
export class ConstellationClient {
	/**
	 * API version for use in versioned endpoint paths
	 */
	private readonly apiVersion = 'intel/v1';

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

			// Handle 404 - parse response to distinguish tool-not-found from route-not-found
			if (response?.status === 404) {
				let errorBody: any;
				try {
					errorBody = await response.json();
				} catch {
					// Non-JSON 404 — likely the route itself doesn't exist
				}

				if (errorBody?.code === 'MCP_TOOL_NOT_FOUND') {
					// Core explicitly reports tool not registered
					throw new ToolNotFoundError(
						errorBody.message ||
							`Tool "${toolName}" not found. Check API catalog for available tools.`,
					);
				}

				// NestJS generic 404 or non-Core response — route/prefix mismatch
				const hint = errorBody?.message || 'No response body';
				throw new ToolNotFoundError(
					`Tool "${toolName}" not found (HTTP 404). ` +
						`This may indicate a route prefix mismatch between MCP client (/${this.apiVersion}/) and the Core API. ` +
						`Server response: ${hint}`,
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
			let errorBody: any;
			try {
				errorBody = await response.json();
			} catch {
				// Non-JSON 404
			}

			if (errorBody?.code === 'MCP_TOOL_NOT_FOUND') {
				throw new ToolNotFoundError(
					errorBody.message || `Tool "${toolName}" not found`,
				);
			}

			const hint = errorBody?.message || 'No response body';
			throw new ToolNotFoundError(
				`Tool "${toolName}" not found (HTTP 404). ` +
					`Possible route prefix mismatch (client: /${this.apiVersion}/). ` +
					`Server response: ${hint}`,
			);
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
		timeout = DEFAULT_TIMEOUT_MS,
		retries = DEFAULT_RETRIES,
		delay = DEFAULT_RETRY_DELAY_MS,
		jitter = DEFAULT_RETRY_JITTER_MS,
	): Promise<Response> {
		for (let i = 1; i <= retries; i++) {
			try {
				const controller = new AbortController();
				let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

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
					// Cap maximum delay
					const cappedDelay = Math.min(jitteredDelay, MAX_RETRY_DELAY_MS);
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

/**
 * Error thrown by the api-Proxy guard when an api.* call's `filePath`
 * argument has an extension not configured in constellation.json.
 *
 * Caught by error-factory.ts and mapped to ErrorCode.UNSUPPORTED_LANGUAGE.
 * Members carry the rejection context so the structured response can
 * surface actionable guidance to the LLM.
 */
export class UnsupportedLanguageError extends Error {
	readonly code = 'UNSUPPORTED_LANGUAGE';
	readonly configuredExtensions: ReadonlyArray<string>;

	constructor(
		readonly filePath: string,
		readonly extension: string,
		configuredExtensions: Iterable<string>,
	) {
		// Store as a sorted array, not a Set. The wrapper uses a Set for O(1)
		// .has() at guard-time, but the error must survive crossing the vm
		// realm boundary on its way to the error-factory. Set instances lose
		// their realm-bound prototype after vm.runInContext rejection unwrap;
		// arrays survive intact.
		const sorted = [...configuredExtensions].sort();
		const configured = sorted.join(', ') || '(none)';
		super(
			`Unsupported file extension '${extension}' for filePath '${filePath}'. ` +
				`This project is configured to index: ${configured}. ` +
				`To query files with extension '${extension}', add it to a language entry's fileExtensions in constellation.json.`,
		);
		this.name = 'UnsupportedLanguageError';
		this.configuredExtensions = sorted;
	}
}
