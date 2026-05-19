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

// Dynamic timeout estimator (SB-802)
// Weights bucket api.<method>() calls by typical execution cost. The estimator
// sums these weights across an execution's AST and converts the total into a
// timeout budget; explicit `timeout` overrides still win and are clamped.
export const METHOD_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
	// Trivial (sync, no I/O)
	listMethods: 0,
	help: 0,
	// Light (single-symbol lookups, connectivity checks)
	ping: 1,
	getCapabilities: 1,
	getSymbolDetails: 1,
	getDependencies: 1,
	// Medium (scoped graph queries)
	searchSymbols: 3,
	getDependents: 3,
	traceSymbolUsage: 3,
	getCallGraph: 3,
	// Heavy (whole-project graph analyses)
	impactAnalysis: 8,
	findOrphanedCode: 8,
	findCircularDependencies: 8,
	getArchitectureOverview: 8,
});

export const TIMEOUT_ESTIMATOR_BASE_MS = 5_000;
export const TIMEOUT_ESTIMATOR_UNIT_MS = 2_000;
// Applied when Promise.all/allSettled fans out ≥ 2 api.* calls — fan-out
// doesn't shrink wall clock when Neo4j is the bottleneck.
export const TIMEOUT_PARALLELISM_FACTOR = 1.25;
// Computed dispatch (api[fn](...)) can't be statically weighted — fall back
// to medium weight and surface a warning in the timeout breakdown.
export const COMPUTED_API_FALLBACK_WEIGHT = 3;
