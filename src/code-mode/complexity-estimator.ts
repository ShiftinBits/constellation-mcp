/**
 * Complexity Estimator
 *
 * Derives a per-execution timeout budget from the user's Code Mode script by
 * counting `api.<method>(…)` call expressions and bucketing them by weight.
 * Operates on a pre-parsed acorn AST so the estimator itself adds no parse
 * pass — the runtime passes in the tree produced by the validator. (The
 * sandbox still runs its own defense-in-depth re-validation internally;
 * eliminating that second parse is intentionally out of scope here.)
 *
 * Pure function, no I/O, deterministic. Sub-millisecond on the 100 KB max code.
 */

import type { Node } from 'acorn';
import {
	type ApiMethodWeightName,
	COMPUTED_API_FALLBACK_WEIGHT,
	MAX_EXECUTION_TIMEOUT_MS,
	METHOD_WEIGHTS,
	MIN_EXECUTION_TIMEOUT_MS,
	TIMEOUT_ESTIMATOR_BASE_MS,
	TIMEOUT_ESTIMATOR_UNIT_MS,
	TIMEOUT_PARALLELISM_FACTOR,
} from '../constants/sandbox-limits.js';
import { walk } from './validators/ast-walker.js';

/**
 * A single api method invocation observed in the script's AST.
 *
 * `computed: true` flags `api[fn](…)` style dispatch — we can't tell the
 * method statically, so it gets the medium fallback weight.
 */
export interface EstimatorCall {
	method: string;
	weight: number;
	computed?: true;
}

/**
 * Breakdown of how the per-execution timeout was derived. Surfaced in
 * response metadata so calling agents can self-correct and we can refine
 * the weight table from real telemetry.
 */
export interface TimeoutBreakdown {
	baseMs: number;
	calls: EstimatorCall[];
	parallelismFactor: number;
	/** Raw estimate from the weighted sum, BEFORE clamping or override. */
	estimatedMs: number;
	/** Value actually used (after explicit override + clamp). */
	appliedMs: number;
	warnings: string[];
}

export interface EstimatorOptions {
	/**
	 * If provided, this value wins over the static estimate. Still clamped
	 * to `[minMs, maxMs]` so a runaway value cannot exceed the hard ceiling.
	 */
	explicitTimeoutMs?: number;
	/** Defaults to {@link MIN_EXECUTION_TIMEOUT_MS}. */
	minMs?: number;
	/** Defaults to {@link MAX_EXECUTION_TIMEOUT_MS}. */
	maxMs?: number;
}

interface PositionedNode {
	start: number;
	end: number;
}

interface ApiCallCheck {
	isApi: boolean;
	computed: boolean;
	methodName?: string;
}

function isApiMemberCall(node: Node): ApiCallCheck {
	if (node.type !== 'CallExpression') return { isApi: false, computed: false };
	const call = node as unknown as {
		callee?: {
			type: string;
			computed?: boolean;
			object?: { type: string; name?: string };
			property?: { type: string; name?: string };
		};
	};
	const callee = call.callee;
	if (!callee || callee.type !== 'MemberExpression') {
		return { isApi: false, computed: false };
	}
	if (callee.object?.type !== 'Identifier' || callee.object.name !== 'api') {
		return { isApi: false, computed: false };
	}
	if (callee.computed) {
		return { isApi: true, computed: true };
	}
	if (callee.property?.type !== 'Identifier' || !callee.property.name) {
		return { isApi: false, computed: false };
	}
	return { isApi: true, computed: false, methodName: callee.property.name };
}

function isPromiseAllCall(node: Node): boolean {
	if (node.type !== 'CallExpression') return false;
	const call = node as unknown as {
		callee?: {
			type: string;
			computed?: boolean;
			object?: { type: string; name?: string };
			property?: { type: string; name?: string };
		};
	};
	const callee = call.callee;
	if (!callee || callee.type !== 'MemberExpression' || callee.computed) {
		return false;
	}
	if (
		callee.object?.type !== 'Identifier' ||
		callee.object.name !== 'Promise'
	) {
		return false;
	}
	if (callee.property?.type !== 'Identifier') return false;
	return (
		callee.property.name === 'all' || callee.property.name === 'allSettled'
	);
}

function clamp(n: number, min: number, max: number): number {
	return Math.min(Math.max(n, min), max);
}

/**
 * Estimate the per-execution timeout in milliseconds from a parsed AST.
 *
 * Algorithm:
 *   1. Walk the AST once. For each `CallExpression`:
 *        - `api.<method>(…)` (static)   → push `{method, weight}` from METHOD_WEIGHTS
 *        - `api[<expr>](…)`  (computed) → push fallback weight + warning
 *        - `Promise.all([…])` / `Promise.allSettled([…])` → remember array range
 *   2. If any Promise fan-out array contains ≥ 2 api.* calls, apply
 *      `TIMEOUT_PARALLELISM_FACTOR` to the total weighted sum.
 *   3. `estimatedMs = BASE + totalWeight * UNIT * parallelismFactor`
 *   4. `appliedMs = clamp(explicitTimeoutMs ?? estimatedMs, minMs, maxMs)`
 */
export function estimateTimeoutMs(
	ast: Node,
	opts: EstimatorOptions = {},
): TimeoutBreakdown {
	const minMs = opts.minMs ?? MIN_EXECUTION_TIMEOUT_MS;
	const maxMs = opts.maxMs ?? MAX_EXECUTION_TIMEOUT_MS;

	const calls: EstimatorCall[] = [];
	const apiCallNodes: PositionedNode[] = [];
	const promiseAllArrays: PositionedNode[] = [];
	const warnings: string[] = [];
	let hasComputedWarning = false;

	walk(ast, {
		enter(node) {
			const apiCheck = isApiMemberCall(node);
			if (apiCheck.isApi) {
				const positioned = node as unknown as PositionedNode;
				if (apiCheck.computed) {
					calls.push({
						method: '<computed>',
						weight: COMPUTED_API_FALLBACK_WEIGHT,
						computed: true,
					});
					if (!hasComputedWarning) {
						warnings.push(
							'Computed api[…]() call detected: cannot determine method statically. ' +
								'Using medium fallback weight for timeout estimation; pass an explicit ' +
								'`timeout` if the call is heavier than expected.',
						);
						hasComputedWarning = true;
					}
				} else if (apiCheck.methodName) {
					// METHOD_WEIGHTS has a literal-keyed type to enable the
					// compile-time coverage check in sandbox.ts; at runtime we
					// look up an arbitrary string from the AST, so the cast is
					// guarded by Object.hasOwn.
					if (Object.hasOwn(METHOD_WEIGHTS, apiCheck.methodName)) {
						const weight =
							METHOD_WEIGHTS[apiCheck.methodName as ApiMethodWeightName];
						calls.push({ method: apiCheck.methodName, weight });
					}
					// Unknown method names are ignored — the api proxy emits a
					// "did you mean ...?" error at runtime, no need to budget for it.
				}
				apiCallNodes.push({
					start: positioned.start,
					end: positioned.end,
				});
			}

			if (isPromiseAllCall(node)) {
				const args = (node as unknown as { arguments?: Node[] }).arguments;
				const first = args?.[0] as
					| (PositionedNode & { type: string })
					| undefined;
				if (first && first.type === 'ArrayExpression') {
					promiseAllArrays.push({ start: first.start, end: first.end });
				}
			}
		},
	});

	// Parallel fan-out: any Promise.all/allSettled array containing ≥ 2 api.* calls
	// triggers the parallelism factor. Range containment (start/end offsets)
	// avoids a second walk.
	let parallel = false;
	for (const arr of promiseAllArrays) {
		let inside = 0;
		for (const apiNode of apiCallNodes) {
			if (apiNode.start >= arr.start && apiNode.end <= arr.end) {
				inside++;
				if (inside >= 2) break;
			}
		}
		if (inside >= 2) {
			parallel = true;
			break;
		}
	}

	const parallelismFactor = parallel ? TIMEOUT_PARALLELISM_FACTOR : 1.0;
	const totalWeight = calls.reduce((sum, c) => sum + c.weight, 0);
	// Round to defend against fractional milliseconds if the parallelism
	// factor or unit constants are ever tuned to non-integer multiples —
	// fractional ms have no meaning to setTimeout and would leak into
	// telemetry.
	const estimatedMs = Math.round(
		TIMEOUT_ESTIMATOR_BASE_MS +
			totalWeight * TIMEOUT_ESTIMATOR_UNIT_MS * parallelismFactor,
	);
	const desired = opts.explicitTimeoutMs ?? estimatedMs;
	const appliedMs = clamp(desired, minMs, maxMs);

	return {
		baseMs: TIMEOUT_ESTIMATOR_BASE_MS,
		calls,
		parallelismFactor,
		estimatedMs,
		appliedMs,
		warnings,
	};
}
