/**
 * Code Mode Runtime
 *
 * Main runtime engine for executing Code Mode scripts.
 * Manages sandbox creation, code execution, and result formatting.
 */

import { CodeModeSandbox, SandboxOptions, SandboxResult } from './sandbox.js';
import type { ConfigContext } from '../config/config-cache.js';
import type { McpErrorResponse } from '../types/mcp-errors.js';
import {
	RESULT_SIZE_WARNING_THRESHOLD,
	RESULT_SIZE_HARD_LIMIT,
	TRUNCATED_ARRAY_PREVIEW_ITEMS,
	TRUNCATED_OBJECT_PREVIEW_KEYS,
	TRUNCATED_STRING_PREVIEW_LENGTH,
} from '../constants/index.js';

/**
 * Options for CodeModeRuntime
 */
export interface CodeModeRuntimeOptions extends SandboxOptions {
	/**
	 * Configuration context to use for this execution.
	 * Required - must be provided by the caller.
	 */
	configContext: ConfigContext;
}

/**
 * Code Mode execution request (internal only)
 */
interface CodeModeRequest {
	code: string;
	timeout?: number;
	projectContext?: {
		projectId: string;
		branchName: string;
	};
}

/**
 * Code Mode execution response
 */
export interface CodeModeResponse {
	success: boolean;
	result?: any;
	error?: string;
	/** Structured error for AI consumption (preserves error type information) */
	structuredError?: McpErrorResponse;
	logs?: string[];
	executionTime?: number;
	/** Git commit hash of the latest indexed data (from API responses) */
	asOfCommit?: string;
	/** ISO timestamp of the most recently indexed file (from API responses) */
	lastIndexedAt?: string;
	/** Disambiguation context for empty results */
	resultContext?: {
		reason: string;
		branchIndexed: boolean;
		indexedFileCount: number;
	};
	metadata?: {
		language: string;
		sandboxed: boolean;
		validated: boolean;
	};
	[x: string]: unknown; // Index signature for MCP SDK compatibility
}

/**
 * Truncated result wrapper
 * FIX SB-95: Structure for returning truncated large results
 */
interface TruncatedResult {
	truncated: true;
	originalSizeKB: number;
	limitKB: number;
	message: string;
	hint: string;
	preview?: unknown;
}

/**
 * Truncate a large result to fit within size limits
 * FIX SB-95: Intelligent truncation that preserves useful information
 *
 * @param result - The result to truncate
 * @param maxSize - Maximum size in bytes
 * @returns Truncated result with metadata
 */
function truncateResult(result: unknown, maxSize: number): TruncatedResult {
	const originalSize = JSON.stringify(result).length;
	const originalSizeKB = Math.round(originalSize / 1024);
	const limitKB = Math.round(maxSize / 1024);

	// Try to provide a useful preview
	let preview: unknown;

	if (Array.isArray(result)) {
		// For arrays, show first few items and count
		const itemCount = result.length;
		const previewItems = result.slice(0, TRUNCATED_ARRAY_PREVIEW_ITEMS);
		preview = {
			type: 'array',
			totalItems: itemCount,
			showing: previewItems.length,
			items: previewItems,
		};
	} else if (typeof result === 'object' && result !== null) {
		// For objects, show keys and first few values
		const keys = Object.keys(result);
		const previewObj: Record<string, unknown> = {};
		for (const key of keys.slice(0, TRUNCATED_OBJECT_PREVIEW_KEYS)) {
			const value = (result as Record<string, unknown>)[key];
			// Only include small values in preview
			const valueStr = JSON.stringify(value);
			if (valueStr && valueStr.length < TRUNCATED_STRING_PREVIEW_LENGTH) {
				previewObj[key] = value;
			} else {
				previewObj[key] = '[truncated]';
			}
		}
		preview = {
			type: 'object',
			totalKeys: keys.length,
			showing: Math.min(keys.length, TRUNCATED_OBJECT_PREVIEW_KEYS),
			keys: keys.slice(0, TRUNCATED_OBJECT_PREVIEW_KEYS * 2),
			sample: previewObj,
		};
	} else if (typeof result === 'string') {
		// For strings, show first portion
		preview = {
			type: 'string',
			totalLength: result.length,
			showing: TRUNCATED_STRING_PREVIEW_LENGTH,
			content: result.slice(0, TRUNCATED_STRING_PREVIEW_LENGTH) + '...',
		};
	}

	return {
		truncated: true,
		originalSizeKB,
		limitKB,
		message: `Result exceeded ${limitKB}KB limit (was ${originalSizeKB}KB)`,
		hint: 'Use pagination parameters (limit, offset) or filter results to reduce response size',
		preview,
	};
}

/**
 * Code Mode Runtime Engine
 */
export class CodeModeRuntime {
	private sandbox: CodeModeSandbox;

	constructor(options: CodeModeRuntimeOptions) {
		// Pass the configContext to the sandbox
		this.sandbox = new CodeModeSandbox({
			...options,
			configContext: options.configContext,
		});
	}

	/**
	 * Execute Code Mode script
	 */
	async execute(request: CodeModeRequest): Promise<CodeModeResponse> {
		console.error('[CodeModeRuntime] Executing code mode script');

		// Validate the code first
		const validation = this.sandbox.validateCode(request.code);
		if (!validation.valid) {
			console.error(
				'[CodeModeRuntime] Code validation failed:',
				validation.errors,
			);
			return {
				success: false,
				error: `Code validation failed:\n${validation.errors?.join('\n')}`,
				metadata: {
					language: 'javascript',
					sandboxed: false,
					validated: false,
				},
			};
		}

		// Log warnings to both console and prepare for response
		const warningLogs: string[] = [];
		if (validation.warnings && validation.warnings.length > 0) {
			for (const warning of validation.warnings) {
				console.error(`[CodeModeRuntime] Warning: ${warning}`);
				warningLogs.push(`[WARN] ${warning}`);
			}
		}

		// Execute in sandbox (JavaScript only)
		const result = await this.sandbox.execute(request.code);

		// Combine warning logs with execution logs
		const allLogs = [...warningLogs, ...(result.logs || [])];

		// FIX SB-95: Check result size and enforce limits
		let finalResult = result.result;
		if (result.result !== undefined) {
			try {
				const resultSize = JSON.stringify(result.result).length;

				// Hard limit: truncate if exceeds 1MB
				if (resultSize > RESULT_SIZE_HARD_LIMIT) {
					const sizeKB = Math.round(resultSize / 1024);
					console.error(
						`[CodeModeRuntime] Result truncated: size (${sizeKB}KB) exceeded ${Math.round(RESULT_SIZE_HARD_LIMIT / 1024)}KB limit.`,
					);
					allLogs.push(
						`[WARN] Result truncated: size (${sizeKB}KB) exceeded limit. Use pagination or filtering.`,
					);
					finalResult = truncateResult(result.result, RESULT_SIZE_HARD_LIMIT);
				}
				// Warning threshold: just warn if between 100KB and 1MB
				else if (resultSize > RESULT_SIZE_WARNING_THRESHOLD) {
					const sizeKB = Math.round(resultSize / 1024);
					console.error(
						`[CodeModeRuntime] Warning: Large result size (${sizeKB}KB). ` +
							'Consider using pagination or filtering to reduce response size.',
					);
					allLogs.push(
						`[WARN] Large result size (${sizeKB}KB). Consider using limit parameter or filtering.`,
					);
				}
			} catch {
				// Ignore serialization errors for size check
			}
		}

		// Format response
		return {
			success: result.success,
			result: finalResult,
			error: result.error,
			structuredError: result.structuredError,
			logs: allLogs.length > 0 ? allLogs : undefined,
			executionTime: result.executionTime,
			asOfCommit: result.asOfCommit,
			lastIndexedAt: result.lastIndexedAt,
			resultContext: result.resultContext,
			metadata: {
				language: 'javascript',
				sandboxed: true,
				validated: true,
			},
		};
	}

	/**
	 * Format execution result for display (token-optimized JSON format)
	 */
	formatResult(response: CodeModeResponse): string {
		const output: any = {
			success: response.success,
		};

		if (response.asOfCommit) {
			output.asOfCommit = response.asOfCommit;
		}
		if (response.lastIndexedAt) {
			output.lastIndexedAt = response.lastIndexedAt;
		}
		if (response.resultContext) {
			output.resultContext = response.resultContext;
		}

		if (response.success) {
			// Success response
			if (response.result !== undefined) {
				output.result = response.result;
			}
			if (response.logs && response.logs.length > 0) {
				output.logs = response.logs;
			}
			if (response.executionTime) {
				output.time = response.executionTime;
			}
		} else {
			// Error response
			if (response.error) {
				output.error = response.error;
			}
			if (response.logs && response.logs.length > 0) {
				output.logs = response.logs;
			}
		}

		return JSON.stringify(output, null, 2);
	}
}

// Note: The previous createCodeModeRuntime() convenience function has been removed.
// Callers must now provide configContext explicitly to CodeModeRuntime constructor.
// This supports multi-project workspaces where config is resolved per-call.
