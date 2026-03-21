/**
 * Sandbox execution limits and defaults
 *
 * These constants configure the Code Mode sandbox execution environment.
 * They are centralized here to allow easy adjustment and to avoid magic numbers.
 */

// Execution timeouts
export const DEFAULT_EXECUTION_TIMEOUT_MS = 30000;
export const MIN_EXECUTION_TIMEOUT_MS = 1000;
export const MAX_EXECUTION_TIMEOUT_MS = 60000;

// Resource limits
export const DEFAULT_MEMORY_LIMIT_MB = 128;
export const MEMORY_CHECK_INTERVAL_MS = 50; // SB-156 - Check interval for memory enforcement
export const DEFAULT_MAX_API_CALLS = 50;

// Output truncation
export const PARAM_SUMMARY_MAX_LENGTH = 100;

// Console output limits
export const MAX_CONSOLE_OBJECT_SIZE = 500;

// Code input limits
export const MAX_CODE_SIZE = 100 * 1024; // 100KB
