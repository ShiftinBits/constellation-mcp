/**
 * Result size and truncation limits
 *
 * These constants control how large results are handled to prevent
 * memory issues and MCP protocol failures.
 */

// Result size thresholds
export const RESULT_SIZE_WARNING_THRESHOLD = 100 * 1024; // 100KB - warn user
export const RESULT_SIZE_HARD_LIMIT = 1024 * 1024; // 1MB - enforce truncation

// Truncation preview limits
export const TRUNCATED_ARRAY_PREVIEW_ITEMS = 5;
export const TRUNCATED_OBJECT_PREVIEW_KEYS = 10;
export const TRUNCATED_STRING_PREVIEW_LENGTH = 1000;

// Source snippet enrichment limits
export const SNIPPET_CONTEXT_LINES = 3; // Lines above/below reference
export const SNIPPET_MAX_LINES = 50; // Max lines per snippet
export const SNIPPET_TOTAL_BUDGET = 512 * 1024; // 512KB total snippet budget
