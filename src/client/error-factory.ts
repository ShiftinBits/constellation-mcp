/**
 * Error Factory - Creates structured error responses for MCP tools
 *
 * Maps error types to structured McpErrorResponse objects that provide
 * machine-readable error codes and actionable guidance for AI assistants.
 */

import {
	ErrorCode,
	type ErrorCodeType,
	type McpErrorResponse,
	isRecoverableError,
} from '../types/mcp-errors.js';
import { getConfigContext } from '../config/config-manager.js';
import { mapErrorToMessage } from './error-mapper.js';
import {
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	ToolNotFoundError,
	ConfigurationError,
	TimeoutError,
} from './constellation-client.js';

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
 * @returns Structured error response with code, guidance, and formatted message
 */
export function createStructuredError(
	error: unknown,
	apiMethod?: string,
): McpErrorResponse {
	const context = getConfigContext();
	const baseContext = {
		projectId: context.projectId,
		branchName: context.branchName,
		apiMethod,
	};

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
				docs: 'https://docs.constellationdev.io/auth',
			},
			formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
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
				docs: 'https://docs.constellationdev.io/auth#permissions',
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
					'Run: constellation init',
					'Run: constellation auth',
					'Run: constellation index',
				],
				context: baseContext,
				docs: 'https://docs.constellationdev.io/setup',
			},
			formattedMessage:
				error.message ||
				'Configuration error - run constellation init to set up',
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
					'Use api.listMethods() to see available tools',
					'Refer to documentation for available tools',
				],
				context: baseContext,
				docs: 'https://docs.constellationdev.io/tools',
			},
			formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
		};
	}

	// Not Found Error (Project not indexed)
	if (error instanceof NotFoundError) {
		return {
			success: false,
			error: {
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
				docs: 'https://docs.constellationdev.io/getting-started',
			},
			formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
		};
	}

	// Timeout Error
	if (error instanceof TimeoutError) {
		return {
			success: false,
			error: {
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
			},
			formattedMessage:
				error.message || 'Operation timed out - try a smaller request',
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
			message: 'An unexpected error occurred',
			recoverable: false,
			guidance: [
				'Try the operation again',
				'Check constellation-core is running',
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
					'Check that constellation-core is running',
					'Verify network connectivity',
					'Check CONSTELLATION_API_URL is correct',
				],
				context: baseContext,
			},
			formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
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
			formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
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
			formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
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
					'Check constellation-core status',
					'Check system resources',
				],
				context: baseContext,
			},
			formattedMessage: error.message,
		};
	}

	// Symbol not found
	if (message.includes('symbol not found') || message.includes('symbol')) {
		return {
			success: false,
			error: {
				code: ErrorCode.SYMBOL_NOT_FOUND,
				type: 'SymbolNotFoundError',
				message: 'Symbol not found in the index',
				recoverable: true,
				guidance: [
					'Verify the symbol name is correct',
					'Use api.searchSymbols() to find the symbol',
					'Re-index the project if the symbol was recently added',
				],
				context: baseContext,
			},
			formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
		};
	}

	// File not found
	if (message.includes('file not found') || message.includes('file')) {
		return {
			success: false,
			error: {
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
			},
			formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
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
				'Check the error message for details',
				'Verify the operation parameters',
				'Report this issue if it persists',
			],
			context: baseContext,
		},
		formattedMessage: mapErrorToMessage(error, apiMethod || 'unknown'),
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

For more information, visit: https://docs.constellationdev.io/auth#permissions
`;
}
