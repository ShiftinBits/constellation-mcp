/**
 * MCP Response Types
 *
 * Core types for Constellation API responses.
 * These define the contract between constellation-core and constellation-mcp.
 */

/**
 * MCP Tool Result interface matching intel-api response format.
 *
 * All api.* method calls return this structure from constellation-core.
 *
 * @typeParam T - The type of the result data (varies by API method)
 *
 * @example
 * ```typescript
 * // Successful response
 * {
 *   success: true,
 *   data: { symbols: [...] },
 *   metadata: { toolName: 'search_symbols', executionTime: 45, ... }
 * }
 *
 * // Error response
 * {
 *   success: false,
 *   error: 'Symbol not found',
 *   metadata: { toolName: 'get_symbol_details', executionTime: 12, ... }
 * }
 * ```
 */
export interface McpToolResult<T = unknown> {
	/** Whether the tool execution succeeded */
	success: boolean;
	/** Result data (only present on success) */
	data?: T;
	/** Error message (only present on failure) */
	error?: string;
	/** Execution metadata */
	metadata: {
		/** Name of the executed tool */
		toolName: string;
		/** Execution time in milliseconds */
		executionTime: number;
		/** Whether result was served from cache */
		cached: boolean;
		/** ISO timestamp of execution */
		timestamp: string;
		/** Git commit hash of the latest indexed data */
		asOfCommit?: string;
		/** ISO timestamp of the most recently indexed file */
		lastIndexedAt?: string;
		/** Disambiguation context for empty results */
		resultContext?: {
			reason: string;
			branchIndexed: boolean;
			indexedFileCount: number;
		};
		/** Additional metadata (varies by tool) */
		[key: string]: unknown;
	};
}
