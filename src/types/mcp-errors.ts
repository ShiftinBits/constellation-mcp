/**
 * MCP Error Types and Codes
 *
 * Defines structured error types for MCP tool responses.
 * These allow AI assistants (Claude Code) to programmatically
 * identify error types and provide appropriate guidance to users.
 */

/**
 * Machine-readable error codes for categorizing failures.
 * These codes enable AI assistants to distinguish between
 * different failure modes and respond appropriately.
 */
export const ErrorCode = {
	// Authentication/Authorization (401/403)
	AUTH_ERROR: 'AUTH_ERROR',
	AUTHZ_ERROR: 'AUTHZ_ERROR',
	AUTH_EXPIRED: 'AUTH_EXPIRED',

	// Configuration
	NOT_CONFIGURED: 'NOT_CONFIGURED',
	API_UNREACHABLE: 'API_UNREACHABLE',

	// Project State
	PROJECT_NOT_INDEXED: 'PROJECT_NOT_INDEXED',
	BRANCH_NOT_FOUND: 'BRANCH_NOT_FOUND',
	STALE_INDEX: 'STALE_INDEX',

	// Tool Execution
	SYMBOL_NOT_FOUND: 'SYMBOL_NOT_FOUND',
	FILE_NOT_FOUND: 'FILE_NOT_FOUND',
	TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	EXECUTION_ERROR: 'EXECUTION_ERROR',
	EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',

	// System
	RATE_LIMITED: 'RATE_LIMITED',
	SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
	INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Structured error information for AI consumption.
 * Provides all the context needed for Claude Code to
 * understand the failure and guide the user to resolution.
 */
export interface McpStructuredError {
	/** Machine-readable error code for categorization */
	code: ErrorCodeType;

	/** Error class name (e.g., 'AuthenticationError') */
	type: string;

	/** Brief human-readable description of the error */
	message: string;

	/**
	 * Whether the user can fix this and retry.
	 * true = user action can resolve (auth, config, indexing)
	 * false = requires developer intervention or is transient
	 */
	recoverable: boolean;

	/** Actionable steps the user can take to resolve the error */
	guidance: string[];

	/** Optional context about where the error occurred */
	context?: {
		/** The tool or API method that was being called */
		tool?: string;
		/** Project ID if available */
		projectId?: string;
		/** Branch name if available */
		branchName?: string;
		/** Specific API method being called */
		apiMethod?: string;
	};

	/** Optional documentation URL for more information */
	docs?: string;
}

/**
 * Complete error response structure for MCP tool errors.
 * Includes both structured error data and a formatted message fallback.
 */
export interface McpErrorResponse {
	/** Always false for error responses */
	success: false;

	/** Structured error information */
	error: McpStructuredError;

	/** Human-readable formatted message (fallback for non-AI consumers) */
	formattedMessage: string;
}

/**
 * Check if a response is an error response
 */
export function isMcpErrorResponse(
	response: unknown,
): response is McpErrorResponse {
	return (
		typeof response === 'object' &&
		response !== null &&
		'success' in response &&
		(response as McpErrorResponse).success === false &&
		'error' in response &&
		typeof (response as McpErrorResponse).error === 'object' &&
		(response as McpErrorResponse).error !== null
	);
}

/**
 * Get error recoverability based on error code
 */
export function isRecoverableError(code: ErrorCodeType): boolean {
	const recoverableCodes: ErrorCodeType[] = [
		ErrorCode.AUTH_ERROR,
		ErrorCode.AUTHZ_ERROR,
		ErrorCode.AUTH_EXPIRED,
		ErrorCode.NOT_CONFIGURED,
		ErrorCode.PROJECT_NOT_INDEXED,
		ErrorCode.BRANCH_NOT_FOUND,
		ErrorCode.STALE_INDEX,
		ErrorCode.VALIDATION_ERROR,
	];
	return recoverableCodes.includes(code);
}
