/**
 * Bounds for the candidate-project discovery scan invoked when `cwd`
 * resolves to a git root that has no `constellation.json`.
 */

/** Maximum directory levels descended when scanning for sibling configs. */
export const CANDIDATE_SCAN_MAX_DEPTH = 3;

/**
 * Maximum directories visited before the scan stops. Caps I/O for
 * pathological monorepos while staying well above the realistic count
 * for a typical multi-project workspace at depth 3.
 */
export const CANDIDATE_SCAN_MAX_DIRS = 200;
