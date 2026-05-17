/**
 * Usage Tracker
 *
 * Captures per-code_intel-call telemetry and fire-and-forget POSTs it to
 * the intel-api receiving endpoint (`POST /intel/v1/usage`). The POST is
 * gated on the `USAGE_TRACKING_ENABLED` env var (default false) and is
 * best-effort — failures are dropped silently and never block the
 * response to the LLM.
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
 * Wire payload accepted by `POST /intel/v1/usage`.
 */
export interface UsageEventPayload {
	project_id: string;
	branch_name: string;
	actual_tokens: number;
	invocations: string[];
	duration_ms: number;
	estimator_version: TokenEstimatorVersion;
}

/**
 * Returns true when `USAGE_TRACKING_ENABLED=true` is set in the
 * environment. All other values (unset, "false", "1", "yes") evaluate
 * to false — strict opt-in.
 */
export function isUsageTrackingEnabled(): boolean {
	return process.env.USAGE_TRACKING_ENABLED === 'true';
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
 * a successful `code_intel` call.
 */
export function buildUsageEvent(args: {
	projectId: string;
	branchName: string;
	invocations: readonly string[];
	synthesizedResponse: string;
	durationMs: number;
}): UsageEventPayload {
	return {
		project_id: args.projectId,
		branch_name: args.branchName,
		actual_tokens: estimateTokens(args.synthesizedResponse),
		invocations: [...args.invocations],
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
