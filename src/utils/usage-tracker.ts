/**
 * Usage Tracker
 *
 * Captures per-code_intel-call telemetry and fire-and-forget POSTs it to
 * the intel-api receiving endpoint (`POST /intel/v1/usage`). The POST is
 * opt-out: enabled by default, disabled only when `CONSTELLATION_USAGE_METRICS`
 * is set to `false` or `0` (case-insensitive). It is best-effort —
 * failures are dropped silently and never block the response to the LLM.
 *
 * The token estimator is inlined here (not imported) because
 * constellation-mcp and constellation-core do not share a package. The
 * canonical vector table lives at
 * `__fixtures__/estimateTokens-vectors.ts` and is a verbatim duplicate
 * of constellation-core/libs/usage-estimator/src/__fixtures__/estimateTokens-vectors.ts
 * — drift is caught by both repos' unit tests.
 */

/**
 * Estimator version stamped on every recorded event. Must match the
 * value used by `constellation-core/libs/usage-estimator` and the
 * receiving endpoint's accepted literal.
 */
export const TOKEN_ESTIMATOR_VERSION = 'chars-div-3.5-v1' as const;
export type TokenEstimatorVersion = typeof TOKEN_ESTIMATOR_VERSION;

/**
 * Canonical camelCase executor names — must match constellation-core's
 * `@constellation/usage-estimator/EXECUTOR_NAMES` and the closed enum
 * in `usage-event.dto.ts`. Drift is caught by the receiving endpoint
 * rejecting unknown names.
 */
export const EXECUTOR_NAMES = [
	'searchSymbols',
	'getSymbolDetails',
	'getDependencies',
	'getDependents',
	'findCircularDependencies',
	'traceSymbolUsage',
	'getCallGraph',
	'findOrphanedCode',
	'impactAnalysis',
	'getArchitectureOverview',
	'ping',
] as const;

export type ExecutorName = (typeof EXECUTOR_NAMES)[number];

const EXECUTOR_NAME_SET: ReadonlySet<string> = new Set(EXECUTOR_NAMES);

export function isExecutorName(value: string): value is ExecutorName {
	return EXECUTOR_NAME_SET.has(value);
}

/**
 * Pure token estimator: `Math.ceil(text.length / 3.5)`. Length is the
 * JavaScript string `.length` (UTF-16 code units), matching the naive
 * baseline used by the offline calibration benchmark.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 3.5);
}

/**
 * Maximum invocations accepted by the receiving endpoint. Must match
 * the server-side cap in `usage-event.dto.ts`. Events exceeding this
 * are rejected with 400, so the MCP-side builder caps locally to
 * avoid silently losing telemetry to that path.
 */
export const MAX_INVOCATIONS_PER_EVENT = 200;

/**
 * Wire payload accepted by `POST /intel/v1/usage`. The closed
 * `ExecutorName` enum is enforced at build time AND at the server's
 * Zod boundary; mismatches surface as 400s, not silent data.
 */
export interface UsageEventPayload {
	project_id: string;
	branch_name: string;
	actual_tokens: number;
	invocations: ExecutorName[];
	duration_ms: number;
	estimator_version: TokenEstimatorVersion;
}

/**
 * Returns true unless `CONSTELLATION_USAGE_METRICS` is explicitly set
 * to `false` or `0` (case-insensitive). Unset, empty, and any other
 * value evaluate to true — opt-out telemetry.
 */
export function isUsageTrackingEnabled(): boolean {
	const raw = process.env.CONSTELLATION_USAGE_METRICS;
	if (raw === undefined) return true;
	const normalized = raw.trim().toLowerCase();
	return normalized !== 'false' && normalized !== '0';
}

/**
 * Resolve the target URL for usage POSTs.
 *
 * Order:
 *   1. `USAGE_ENDPOINT_URL` (full URL override) if set
 *   2. `<apiUrl>/intel/v1/usage` otherwise
 */
export function resolveUsageEndpointUrl(apiUrl: string): string {
	const override = process.env.USAGE_ENDPOINT_URL;
	if (override && override.length > 0) {
		return override;
	}
	const trimmed = apiUrl.replace(/\/+$/, '');
	return `${trimmed}/intel/v1/usage`;
}

/**
 * Build a usage event payload from the inputs available at the end of
 * a successful `code_intel` call. Returns `null` when the filtered
 * invocations array is empty — the receiving endpoint enforces
 * `.min(1)` and would 400 on an empty array, which the fire-and-forget
 * POST would swallow silently. Returning `null` lets callers skip the
 * POST entirely.
 */
export function buildUsageEvent(args: {
	projectId: string;
	branchName: string;
	invocations: readonly string[];
	synthesizedResponse: string;
	durationMs: number;
}): UsageEventPayload | null {
	// Defense-in-depth: filter to the closed enum and cap the array to
	// match the receiving endpoint's Zod schema. The server would 400 on
	// either violation and the fire-and-forget POST would swallow the
	// error silently — the local cap keeps the telemetry path alive
	// even if a future caller pushes a non-executor name into the buffer.
	const validInvocations: ExecutorName[] = [];
	for (const name of args.invocations) {
		if (validInvocations.length >= MAX_INVOCATIONS_PER_EVENT) break;
		if (isExecutorName(name)) {
			validInvocations.push(name);
		}
	}

	if (validInvocations.length === 0) {
		return null;
	}

	return {
		project_id: args.projectId,
		branch_name: args.branchName,
		actual_tokens: estimateTokens(args.synthesizedResponse),
		invocations: validInvocations,
		duration_ms: Math.max(0, Math.round(args.durationMs)),
		estimator_version: TOKEN_ESTIMATOR_VERSION,
	};
}

/**
 * Fire-and-forget POST of one usage event.
 *
 * Errors are logged at debug level via `console.error` and otherwise
 * swallowed — the caller is never made to await the result, and POST
 * failures never propagate to the LLM-facing response.
 */
export function postUsageEvent(args: {
	endpointUrl: string;
	accessKey: string;
	payload: UsageEventPayload;
	/** Optional abort timeout in ms. Defaults to 5000. */
	timeoutMs?: number;
}): void {
	const { endpointUrl, accessKey, payload } = args;
	const timeoutMs = args.timeoutMs ?? 5000;

	if (!accessKey) {
		// An empty bearer token would always 401 and the failure would
		// be swallowed silently — every event would be lost. Skip the
		// POST and surface the misconfiguration via the debug channel
		// instead.
		if (process.env.DEBUG) {
			console.error('[usage-tracker] access key missing; skipping POST');
		}
		return;
	}

	if (typeof globalThis.fetch !== 'function') {
		if (process.env.DEBUG) {
			console.error('[usage-tracker] global fetch unavailable; skipping POST');
		}
		return;
	}

	const controller =
		typeof AbortController === 'function' ? new AbortController() : undefined;
	const abortTimer = controller
		? setTimeout(() => controller.abort(), timeoutMs)
		: undefined;

	const cleanup = () => {
		if (abortTimer) {
			clearTimeout(abortTimer);
		}
	};

	try {
		const promise = globalThis.fetch(endpointUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${accessKey}`,
			},
			body: JSON.stringify(payload),
			signal: controller?.signal,
		});

		Promise.resolve(promise)
			.then((res) => {
				cleanup();
				if (process.env.DEBUG && !res.ok) {
					console.error(
						`[usage-tracker] POST returned status ${res.status} (ignored)`,
					);
				}
			})
			.catch((err) => {
				cleanup();
				if (process.env.DEBUG) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[usage-tracker] POST failed: ${msg} (ignored)`);
				}
			});
	} catch (err) {
		cleanup();
		if (process.env.DEBUG) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(
				`[usage-tracker] POST threw synchronously: ${msg} (ignored)`,
			);
		}
	}
}
