/**
 * Error Factory - Creates structured error responses for MCP tools
 *
 * Maps error types to structured McpErrorResponse objects that provide
 * machine-readable error codes and actionable guidance for AI assistants.
 */

import { MemoryExceededError } from '../code-mode/sandbox.js';
import {
	configCache,
	ConfigCacheError,
	type ConfigContext,
} from '../config/config-cache.js';
import { DOCS_URLS } from '../constants/urls.js';
import { ErrorCode, type McpErrorResponse } from '../types/mcp-errors.js';
import {
	AuthenticationError,
	AuthorizationError,
	ConfigurationError,
	NotFoundError,
	TimeoutError,
	ToolNotFoundError,
} from './constellation-client.js';
import { mapErrorToMessage } from './error-mapper.js';

/**
 * Validation error with optional details for structured error responses.
 * Use this for input validation failures (code size, binary chars, malformed input).
 */
export class ValidationError extends Error {
	constructor(
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'ValidationError';
	}
}

/**
 * FIX SB-88: Check if user has configured authentication (has API key set)
 * Used to conditionally include detailed API suggestions in error responses
 */
function hasApiKeyConfigured(): boolean {
	const context = configCache.getDefaultConfig();
	return Boolean(context?.apiKey);
}

/**
 * Create a structured error response from any error type.
 *
 * This function preserves error type information that would otherwise
 * be lost when errors are caught and converted to strings. The structured
 * response allows AI assistants to programmatically handle different
 * failure modes.
 *
 * @param error - The error to convert
 * @param apiMethod - Optional name of the API method being called
 * @param configContext - Optional config context for accurate project/branch info in multi-project scenarios
 * @returns Structured error response with code, guidance, and formatted message
 */
export function createStructuredError(
	error: unknown,
	apiMethod?: string,
	configContext?: ConfigContext,
): McpErrorResponse {
	// Use provided configContext for accurate error reporting in multi-project scenarios,
	// fall back to default config if not provided
	const context = configContext || configCache.getDefaultConfig();
	const baseContext = {
		projectId: context?.projectId || 'unknown',
		branchName: context?.branchName || 'unknown',
		apiMethod,
	};

	// ConfigCacheError - issues with config resolution
	if (error instanceof ConfigCacheError) {
		return {
			success: false,
			error: {
				code: ErrorCode.NOT_CONFIGURED,
				type: 'ConfigCacheError',
				message: `[${error.code}] ${error.message}`,
				recoverable: true,
				guidance: error.guidance,
				context: baseContext,
				docs: DOCS_URLS.setup,
			},
			formattedMessage: error.message,
		};
	}

	// Authentication Error (401)
	if (error instanceof AuthenticationError) {
		return {
			success: false,
			error: {
				code: ErrorCode.AUTH_ERROR,
				type: 'AuthenticationError',
				message: 'Authentication failed - invalid or missing access key',
				recoverable: true,
				guidance: [
					'Run: constellation auth',
					'Verify CONSTELLATION_ACCESS_KEY environment variable is set',
					'Check that your access key has not expired',
				],
				context: baseContext,
				docs: DOCS_URLS.auth,
			},
			formattedMessage: mapErrorToMessage(
				error,
				apiMethod || 'unknown',
				baseContext,
			),
		};
	}

	// Authorization Error (403)
	if (error instanceof AuthorizationError) {
		return {
			success: false,
			error: {
				code: ErrorCode.AUTHZ_ERROR,
				type: 'AuthorizationError',
				message: 'Authorization failed - insufficient permissions',
				recoverable: true,
				guidance: [
					'Verify your access key has the required permissions',
					'Contact your organization admin to request access',
					'Check that you are targeting the correct project',
				],
				context: baseContext,
				docs: DOCS_URLS.authPermissions,
			},
			formattedMessage: formatAuthorizationError(baseContext),
		};
	}

	// Configuration Error
	if (error instanceof ConfigurationError) {
		return {
			success: false,
			error: {
				code: ErrorCode.NOT_CONFIGURED,
				type: 'ConfigurationError',
				message: 'Constellation is not configured for this project',
				recoverable: true,
				guidance: [
					'Provide the required `cwd` parameter with the absolute path to the project directory (e.g., cwd: "/path/to/project")',
					'Verify the project has a constellation.json file at the git root',
					'If no constellation.json exists, run: constellation init && constellation auth && constellation index',
				],
				context: baseContext,
				docs: DOCS_URLS.setup,
			},
			formattedMessage:
				error.message ||
				'Configuration error - run constellation init to set up',
		};
	}

	// Validation Error (input validation failures)
	if (
		error instanceof ValidationError ||
		(error instanceof Error && error.name === 'ValidationError')
	) {
		const validationError = error as ValidationError;
		// Use custom guidance from details if provided, otherwise use defaults
		const guidance = Array.isArray(validationError.details?.guidance)
			? (validationError.details.guidance as string[])
			: [
					'Check the input data meets requirements',
					'Review size limits and encoding requirements',
					'Break large operations into smaller steps',
				];
		// Extract non-guidance details for context
		const { guidance: _, ...otherDetails } = validationError.details || {};
		return {
			success: false,
			error: {
				code: ErrorCode.VALIDATION_ERROR,
				type: 'ValidationError',
				message: validationError.message,
				recoverable: true,
				guidance,
				context: {
					...baseContext,
					...otherDetails,
				},
			},
			formattedMessage: validationError.message,
		};
	}

	// Tool Not Found Error
	if (error instanceof ToolNotFoundError) {
		return {
			success: false,
			error: {
				code: ErrorCode.TOOL_NOT_FOUND,
				type: 'ToolNotFoundError',
				message: 'The requested tool does not exist',
				recoverable: false,
				guidance: [
					'Check the tool name is spelled correctly',
					// FIX SB-88: Only mention API method when authenticated
					...(hasApiKeyConfigured()
						? ['Use api.listMethods() to see available tools']
						: []),
					'Refer to documentation for available tools',
				],
				context: baseContext,
				docs: DOCS_URLS.tools,
			},
			formattedMessage: mapErrorToMessage(
				error,
				apiMethod || 'unknown',
				baseContext,
			),
		};
	}

	// Not Found Error (Project not indexed)
	if (error instanceof NotFoundError) {
		const errorDetails: McpErrorResponse['error'] = {
			code: ErrorCode.PROJECT_NOT_INDEXED,
			type: 'NotFoundError',
			message: 'Project or resource not found - may need indexing',
			recoverable: true,
			guidance: [
				'Run: constellation index',
				'Verify you are in the correct project directory',
				'Check that the branch has been indexed',
			],
			context: baseContext,
			docs: DOCS_URLS.gettingStarted,
		};

		// FIX SB-88: Only include detailed API suggestions when authenticated
		if (hasApiKeyConfigured()) {
			errorDetails.suggestedCode = `// Check project capabilities first:
const caps = await api.getCapabilities();
if (!caps.isIndexed) {
  return { error: "Project not indexed", action: "Run: constellation index" };
}`;
			errorDetails.alternativeApproach = {
				tool: 'Glob',
				description: 'Use Glob and Grep to explore the codebase until indexed',
			};
		}

		return {
			success: false,
			error: errorDetails,
			formattedMessage: mapErrorToMessage(
				error,
				apiMethod || 'unknown',
				baseContext,
			),
		};
	}

	// Timeout Error
	if (error instanceof TimeoutError) {
		const errorDetails: McpErrorResponse['error'] = {
			code: ErrorCode.EXECUTION_TIMEOUT,
			type: 'TimeoutError',
			message: 'Operation timed out',
			recoverable: true,
			guidance: [
				'Try a more specific query to reduce processing time',
				'Break down the request into smaller parts',
				'Check network connectivity',
			],
			context: baseContext,
		};

		// FIX SB-88: Only include detailed API suggestions when authenticated
		if (hasApiKeyConfigured()) {
			errorDetails.suggestedCode = `// Retry with reduced scope:
// If using depth, reduce it: depth=1 instead of depth=3
// If using limit, reduce it: limit=10 instead of limit=100
const result = await api.searchSymbols({
  query: "...",
  limit: 10  // Start small
});`;
		}

		return {
			success: false,
			error: errorDetails,
			formattedMessage:
				error.message || 'Operation timed out - try a smaller request',
		};
	}

	// Memory Exceeded Error (SB-156)
	if (error instanceof MemoryExceededError) {
		return {
			success: false,
			error: {
				code: ErrorCode.MEMORY_EXCEEDED,
				type: 'MemoryExceededError',
				message: error.message,
				recoverable: true,
				guidance: [
					'Reduce the amount of data being processed',
					'Use pagination (limit parameter) to process in smaller batches',
					'Avoid creating large arrays or objects in loops',
					'Break complex operations into smaller sequential steps',
				],
				context: baseContext,
			},
			formattedMessage: error.message,
		};
	}

	// Generic Error - analyze message to categorize
	if (error instanceof Error) {
		return createErrorFromMessage(error, baseContext, apiMethod);
	}

	// Unknown error type
	return {
		success: false,
		error: {
			code: ErrorCode.INTERNAL_ERROR,
			type: 'UnknownError',
			message: error ? String(error) : 'An unexpected error occurred',
			recoverable: false,
			guidance: [
				'Review the error message and try the operation again',
				'Check Constellation service connectivity with `await api.ping()`',
				'Report this issue if it persists',
			],
			context: baseContext,
		},
		formattedMessage: `An unexpected error occurred: ${String(error)}`,
	};
}

/**
 * Analyze error message to determine error type for generic errors
 */
function createErrorFromMessage(
	error: Error,
	baseContext: {
		projectId: string;
		branchName: string;
		apiMethod?: string;
	},
	apiMethod?: string,
): McpErrorResponse {
	const message = error.message.toLowerCase();

	// Network errors
	if (
		message.includes('fetch failed') ||
		message.includes('econnrefused') ||
		message.includes('enotfound') ||
		message.includes('network')
	) {
		return {
			success: false,
			error: {
				code: ErrorCode.API_UNREACHABLE,
				type: 'NetworkError',
				message: 'Cannot connect to Constellation API',
				recoverable: true,
				guidance: [
					'Check Constellation service connectivity with `await api.ping()`',
					'Verify network connectivity',
					'Check CONSTELLATION_API_URL is correct',
				],
				context: baseContext,
			},
			formattedMessage: mapErrorToMessage(
				error,
				apiMethod || 'unknown',
				baseContext,
			),
		};
	}

	// Timeout errors
	if (message.includes('timeout') || message.includes('timed out')) {
		return {
			success: false,
			error: {
				code: ErrorCode.EXECUTION_TIMEOUT,
				type: 'TimeoutError',
				message: 'Operation timed out',
				recoverable: true,
				guidance: [
					'Try a more specific query',
					'Break down the request into smaller parts',
					'Increase timeout if possible',
				],
				context: baseContext,
			},
			formattedMessage: mapErrorToMessage(
				error,
				apiMethod || 'unknown',
				baseContext,
			),
		};
	}

	// Validation errors
	if (
		message.includes('invalid') ||
		message.includes('validation') ||
		message.includes('required')
	) {
		return {
			success: false,
			error: {
				code: ErrorCode.VALIDATION_ERROR,
				type: 'ValidationError',
				message: 'Invalid parameters provided',
				recoverable: true,
				guidance: [
					'Check the parameter values are correct',
					'Verify required parameters are provided',
					'Refer to tool documentation for valid inputs',
				],
				context: baseContext,
			},
			formattedMessage: mapErrorToMessage(
				error,
				apiMethod || 'unknown',
				baseContext,
			),
		};
	}

	// Rate limiting
	if (message.includes('rate limit') || message.includes('too many requests')) {
		return {
			success: false,
			error: {
				code: ErrorCode.RATE_LIMITED,
				type: 'RateLimitError',
				message: 'Too many requests - rate limited',
				recoverable: true,
				guidance: [
					'Wait a moment before retrying',
					'Reduce request frequency',
					'Contact support if this persists',
				],
				context: baseContext,
			},
			formattedMessage: error.message,
		};
	}

	// Service unavailable
	if (
		message.includes('503') ||
		message.includes('service unavailable') ||
		message.includes('temporarily unavailable')
	) {
		return {
			success: false,
			error: {
				code: ErrorCode.SERVICE_UNAVAILABLE,
				type: 'ServiceUnavailableError',
				message: 'Service temporarily unavailable',
				recoverable: true,
				guidance: [
					'Wait a moment and try again',
					'Check Constellation service connectivity with `await api.ping()`',
					'Check system resources',
				],
				context: baseContext,
			},
			formattedMessage: error.message,
		};
	}

	// Symbol not found
	if (
		message.includes('symbol not found') ||
		message.includes('no symbol') ||
		message.includes('symbol does not exist')
	) {
		const errorDetails: McpErrorResponse['error'] = {
			code: ErrorCode.SYMBOL_NOT_FOUND,
			type: 'SymbolNotFoundError',
			message: 'Symbol not found in the index',
			recoverable: true,
			guidance: [
				'Verify the symbol name is correct',
				// FIX SB-88: Only mention API method when authenticated
				...(hasApiKeyConfigured()
					? ['Use api.searchSymbols() to find the symbol']
					: []),
				'Re-index the project if the symbol was recently added',
			],
			context: baseContext,
		};

		// FIX SB-88: Only include detailed API suggestions when authenticated
		if (hasApiKeyConfigured()) {
			// Extract symbol name from error message for a targeted broader search
			const symbolMatch = error.message.match(
				/(?:symbol|not found)[:\s]+["']?(\w+)["']?/i,
			);
			const failedName = symbolMatch?.[1];
			const broadQuery = failedName
				? failedName.slice(0, Math.max(4, Math.ceil(failedName.length / 2)))
				: '...';

			errorDetails.suggestedCode = `// Try a broader search to find similar symbols:
const results = await api.searchSymbols({
  query: "${broadQuery}",  // Broadened from "${failedName || '...'}"
  limit: 20
});
return results.symbols.map(s => ({
  name: s.name,
  file: s.filePath,
  kind: s.kind
}));`;
			errorDetails.alternativeApproach = {
				tool: 'Grep',
				description: 'Search for the symbol name as text in source files',
			};
		}

		return {
			success: false,
			error: errorDetails,
			formattedMessage: mapErrorToMessage(
				error,
				apiMethod || 'unknown',
				baseContext,
			),
		};
	}

	// File not found
	if (
		message.includes('file not found') ||
		message.includes('no file') ||
		message.includes('no such file') ||
		message.includes('file does not exist')
	) {
		const errorDetails: McpErrorResponse['error'] = {
			code: ErrorCode.FILE_NOT_FOUND,
			type: 'FileNotFoundError',
			message: 'File not found in the index',
			recoverable: true,
			guidance: [
				'Verify the file path is correct',
				'Check the file exists in the repository',
				'Re-index the project if the file was recently added',
			],
			context: baseContext,
		};

		// FIX SB-88: Only include detailed API suggestions when authenticated
		if (hasApiKeyConfigured()) {
			// Extract file path from error message for targeted suggestion
			const fileMatch = error.message.match(
				/(?:file|path)[:\s]+["']?([^\s"']+)["']?/i,
			);
			const failedPath = fileMatch?.[1];
			const fileName =
				failedPath
					?.split('/')
					.pop()
					?.replace(/\.\w+$/, '') || '...';

			errorDetails.suggestedCode = `// Search for symbols to discover correct file paths:
const results = await api.searchSymbols({
  query: "${fileName}",  // Search by filename stem
  limit: 10
});
// Check filePath in results to find correct paths`;
			errorDetails.alternativeApproach = {
				tool: 'Glob',
				description: 'Use Glob to find files matching a pattern',
			};
		}

		return {
			success: false,
			error: errorDetails,
			formattedMessage: mapErrorToMessage(
				error,
				apiMethod || 'unknown',
				baseContext,
			),
		};
	}

	// Default: execution error
	return {
		success: false,
		error: {
			code: ErrorCode.EXECUTION_ERROR,
			type: 'ExecutionError',
			message: error.message,
			recoverable: false,
			guidance: [
				'Verify all api.* calls use await (they are async)',
				'Check method name spelling — run api.listMethods() for valid names',
				'Check parameter types — run api.help("methodName") for expected signature',
			],
			context: baseContext,
		},
		formattedMessage: mapErrorToMessage(
			error,
			apiMethod || 'unknown',
			baseContext,
		),
	};
}

/**
 * Format authorization error message
 */
function formatAuthorizationError(context: {
	projectId: string;
	branchName: string;
}): string {
	return `Authorization Failed

Your access key does not have permission for this operation.

**Context:**
  Project ID: ${context.projectId}
  Branch: ${context.branchName}

**How to fix this:**

1. Verify your access key has the required permissions
2. Contact your organization admin to request access
3. Check that you are targeting the correct project

For more information, visit: ${DOCS_URLS.authPermissions}
`;
}
