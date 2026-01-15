/**
 * Code Mode Runtime
 *
 * Main runtime engine for executing Code Mode scripts.
 * Manages sandbox creation, code execution, and result formatting.
 */

import { CodeModeSandbox, SandboxOptions, SandboxResult } from './sandbox.js';
import { getConfigContext } from '../config/config-manager.js';
import type { McpErrorResponse } from '../types/mcp-errors.js';

/**
 * Result size thresholds
 * FIX SB-95: Add hard limit to prevent memory issues and MCP protocol failures
 */
const RESULT_SIZE_WARNING_THRESHOLD = 100 * 1024; // 100KB - warn user
const RESULT_SIZE_HARD_LIMIT = 1024 * 1024; // 1MB - enforce truncation

/**
 * Code Mode execution request
 */
export interface CodeModeRequest {
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
		const previewItems = result.slice(0, 5);
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
		for (const key of keys.slice(0, 10)) {
			const value = (result as Record<string, unknown>)[key];
			// Only include small values in preview
			const valueStr = JSON.stringify(value);
			if (valueStr && valueStr.length < 1000) {
				previewObj[key] = value;
			} else {
				previewObj[key] = '[truncated]';
			}
		}
		preview = {
			type: 'object',
			totalKeys: keys.length,
			showing: Math.min(keys.length, 10),
			keys: keys.slice(0, 20),
			sample: previewObj,
		};
	} else if (typeof result === 'string') {
		// For strings, show first portion
		preview = {
			type: 'string',
			totalLength: result.length,
			showing: 1000,
			content: result.slice(0, 1000) + '...',
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

	constructor(options: SandboxOptions = {}) {
		this.sandbox = new CodeModeSandbox(options);
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

	/**
	 * Format a value for display
	 */
	private formatValue(value: any): string {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';

		if (typeof value === 'object') {
			try {
				return JSON.stringify(value, null, 2);
			} catch {
				return String(value);
			}
		}

		return String(value);
	}
}

/**
 * Create a Code Mode runtime with default configuration
 */
export function createCodeModeRuntime(): CodeModeRuntime {
	const configContext = getConfigContext();

	return new CodeModeRuntime({
		timeout: 30000, // 30 seconds
		allowConsole: true,
		allowTimers: false,
		projectContext: {
			projectId: configContext.projectId,
			branchName: configContext.branchName,
		},
	});
}
