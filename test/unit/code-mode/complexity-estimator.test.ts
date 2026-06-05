/**
 * Complexity Estimator Unit Tests
 *
 * Verifies the static AST-based timeout estimator that derives per-execution
 * timeout budgets from `api.<method>(…)` call counts and bucket weights.
 *
 * Deterministic, no I/O.
 */

import { describe, it, expect } from '@jest/globals';
import { parse } from 'acorn';
import type { Node } from 'acorn';
import { estimateTimeoutMs } from '../../../src/code-mode/complexity-estimator.js';
import {
	COLD_START_GRACE_MS,
	COMPUTED_API_FALLBACK_WEIGHT,
	MAX_EXECUTION_TIMEOUT_MS,
	MIN_EXECUTION_TIMEOUT_MS,
	TIMEOUT_ESTIMATOR_BASE_MS,
	TIMEOUT_ESTIMATOR_UNIT_MS,
	TIMEOUT_PARALLELISM_FACTOR,
} from '../../../src/constants/sandbox-limits.js';

function ast(code: string): Node {
	return parse(code, {
		ecmaVersion: 'latest',
		allowAwaitOutsideFunction: true,
		allowReturnOutsideFunction: true,
	});
}

describe('estimateTimeoutMs', () => {
	describe('bucket weights', () => {
		it('weights trivial sync utilities at 0 (only base budget)', () => {
			const result = estimateTimeoutMs(
				ast('api.listMethods(); api.help("ping");'),
			);
			expect(result.calls).toEqual([
				{ method: 'listMethods', weight: 0 },
				{ method: 'help', weight: 0 },
			]);
			expect(result.parallelismFactor).toBe(1);
			expect(result.estimatedMs).toBe(TIMEOUT_ESTIMATOR_BASE_MS);
			expect(result.appliedMs).toBe(TIMEOUT_ESTIMATOR_BASE_MS);
		});

		it('weights a light call at 1 unit', () => {
			const result = estimateTimeoutMs(ast('await api.ping();'));
			expect(result.calls).toEqual([{ method: 'ping', weight: 1 }]);
			expect(result.estimatedMs).toBe(
				TIMEOUT_ESTIMATOR_BASE_MS + 1 * TIMEOUT_ESTIMATOR_UNIT_MS,
			);
		});

		it('weights a medium call at 3 units', () => {
			const result = estimateTimeoutMs(
				ast('await api.searchSymbols({ query: "X" });'),
			);
			expect(result.calls).toEqual([{ method: 'searchSymbols', weight: 3 }]);
			expect(result.estimatedMs).toBe(
				TIMEOUT_ESTIMATOR_BASE_MS + 3 * TIMEOUT_ESTIMATOR_UNIT_MS,
			);
		});

		it('weights a heavy call at 8 units', () => {
			const result = estimateTimeoutMs(
				ast('await api.findOrphanedCode({ limit: 5 });'),
			);
			expect(result.calls).toEqual([{ method: 'findOrphanedCode', weight: 8 }]);
			expect(result.estimatedMs).toBe(
				TIMEOUT_ESTIMATOR_BASE_MS + 8 * TIMEOUT_ESTIMATOR_UNIT_MS,
			);
		});
	});

	describe('Promise.all / Promise.allSettled parallelism', () => {
		it('applies the parallelism factor when Promise.all has ≥2 api calls', () => {
			// The exact repro from the bug report.
			const code = `await Promise.all([
				api.findCircularDependencies({ maxCycleLength: 8 }),
				api.findOrphanedCode({ limit: 5 })
			]);`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.parallelismFactor).toBe(TIMEOUT_PARALLELISM_FACTOR);
			// 5000 + (8 + 8) * 2000 * 1.25 = 45000
			expect(result.estimatedMs).toBe(45_000);
			expect(result.appliedMs).toBe(45_000);
		});

		it('applies the parallelism factor for Promise.allSettled too', () => {
			const code = `await Promise.allSettled([
				api.findCircularDependencies({}),
				api.findOrphanedCode({})
			]);`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.parallelismFactor).toBe(TIMEOUT_PARALLELISM_FACTOR);
		});

		it('does NOT apply the factor when Promise.all wraps a single api call', () => {
			const code = `await Promise.all([api.findOrphanedCode({ limit: 5 })]);`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.parallelismFactor).toBe(1);
			expect(result.estimatedMs).toBe(
				TIMEOUT_ESTIMATOR_BASE_MS + 8 * TIMEOUT_ESTIMATOR_UNIT_MS,
			);
		});

		it('does NOT apply the factor when api calls are sequential awaits', () => {
			const code = `
				const a = await api.findCircularDependencies({});
				const b = await api.findOrphanedCode({});
			`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.parallelismFactor).toBe(1);
		});

		it('does NOT apply the factor for Promise.race (not a fan-out primitive)', () => {
			const code = `await Promise.race([
				api.findCircularDependencies({}),
				api.findOrphanedCode({})
			]);`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.parallelismFactor).toBe(1);
		});

		it('applies the factor when Promise.all mixes computed and static api calls', () => {
			const code = `
				const fn = 'findOrphanedCode';
				await Promise.all([
					api.findCircularDependencies({}),
					api[fn]({})
				]);
			`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.parallelismFactor).toBe(TIMEOUT_PARALLELISM_FACTOR);
			expect(result.calls).toHaveLength(2);
		});
	});

	describe('computed api[…]() fallback', () => {
		it('records computed calls with the medium fallback weight and a warning', () => {
			const code = `const fn = 'findOrphanedCode'; await api[fn]({});`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.calls).toEqual([
				{
					method: '<computed>',
					weight: COMPUTED_API_FALLBACK_WEIGHT,
					computed: true,
				},
			]);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toMatch(/computed api/i);
		});

		it('emits the computed warning at most once even with multiple computed calls', () => {
			const code = `
				const a = 'ping';
				const b = 'searchSymbols';
				await api[a]();
				await api[b]({ query: 'X' });
			`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.calls).toHaveLength(2);
			expect(result.warnings).toHaveLength(1);
		});
	});

	describe('clamps', () => {
		it('clamps to MIN_EXECUTION_TIMEOUT_MS when the estimate would be below the floor', () => {
			// Empty script — no api calls, only base. Override below the floor.
			const result = estimateTimeoutMs(ast('// nothing'), {
				explicitTimeoutMs: 1,
			});
			expect(result.appliedMs).toBe(MIN_EXECUTION_TIMEOUT_MS);
			expect(result.estimatedMs).toBe(TIMEOUT_ESTIMATOR_BASE_MS);
		});

		it('clamps to MAX_EXECUTION_TIMEOUT_MS for a heavy parallel script', () => {
			// 8 heavy calls in Promise.all → 5000 + 64*2000*1.25 = 165000ms,
			// well past the 60s ceiling.
			const calls = Array.from({ length: 8 })
				.map(() => 'api.findOrphanedCode({})')
				.join(', ');
			const code = `await Promise.all([${calls}]);`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.estimatedMs).toBeGreaterThan(MAX_EXECUTION_TIMEOUT_MS);
			expect(result.appliedMs).toBe(MAX_EXECUTION_TIMEOUT_MS);
		});
	});

	describe('explicit override', () => {
		it('uses the explicit value over the static estimate (still under cap)', () => {
			const code = `await Promise.all([
				api.findCircularDependencies({}),
				api.findOrphanedCode({})
			]);`;
			const result = estimateTimeoutMs(ast(code), { explicitTimeoutMs: 1500 });
			expect(result.appliedMs).toBe(1500);
			// estimatedMs still reflects the static estimate.
			expect(result.estimatedMs).toBe(45_000);
		});

		it('clamps an undersized explicit override up to MIN', () => {
			const result = estimateTimeoutMs(ast('await api.ping();'), {
				explicitTimeoutMs: 100,
			});
			expect(result.appliedMs).toBe(MIN_EXECUTION_TIMEOUT_MS);
		});

		it('clamps an oversized explicit override down to MAX', () => {
			const result = estimateTimeoutMs(ast('await api.ping();'), {
				explicitTimeoutMs: 999_999,
			});
			expect(result.appliedMs).toBe(MAX_EXECUTION_TIMEOUT_MS);
		});
	});

	describe('loop interaction with the 50-call cap', () => {
		it('does not unroll loops — one source-location counts once', () => {
			// A loop runs api.searchSymbols 100 times at runtime but only
			// appears once in the AST. The estimator counts it once; the
			// 50-call runtime cap (sandbox-limits) is the safety net.
			const code = `
				for (let i = 0; i < 100; i++) {
					await api.searchSymbols({ query: 'x' + i });
				}
			`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.calls).toEqual([{ method: 'searchSymbols', weight: 3 }]);
			expect(result.appliedMs).toBeLessThanOrEqual(MAX_EXECUTION_TIMEOUT_MS);
		});
	});

	describe('non-api noise is ignored', () => {
		it('ignores console.*, Math.*, and user helper calls', () => {
			const code = `
				console.log("hi");
				const x = Math.max(1, 2);
				function helper() {}
				helper();
				await api.ping();
			`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.calls).toEqual([{ method: 'ping', weight: 1 }]);
		});

		it('ignores unknown api.foo() method names (proxy raises at runtime)', () => {
			const code = `await api.notARealMethod();`;
			const result = estimateTimeoutMs(ast(code));
			expect(result.calls).toEqual([]);
			expect(result.estimatedMs).toBe(TIMEOUT_ESTIMATOR_BASE_MS);
		});
	});

	describe('output shape', () => {
		it('returns a breakdown with all expected fields', () => {
			const result = estimateTimeoutMs(ast('await api.ping();'));
			expect(result).toEqual({
				baseMs: TIMEOUT_ESTIMATOR_BASE_MS,
				calls: [{ method: 'ping', weight: 1 }],
				parallelismFactor: 1,
				estimatedMs: TIMEOUT_ESTIMATOR_BASE_MS + TIMEOUT_ESTIMATOR_UNIT_MS,
				coldStartGraceMs: 0,
				appliedMs: TIMEOUT_ESTIMATOR_BASE_MS + TIMEOUT_ESTIMATOR_UNIT_MS,
				warnings: [],
			});
		});
	});

	describe('cold-start grace', () => {
		it('adds coldStartGraceMs to the auto-estimate and records it in the breakdown', () => {
			// Light call: base + 1 unit = 7000ms; grace lifts it to 17000ms.
			const result = estimateTimeoutMs(ast('await api.ping();'), {
				coldStartGraceMs: COLD_START_GRACE_MS,
			});
			expect(result.estimatedMs).toBe(
				TIMEOUT_ESTIMATOR_BASE_MS + TIMEOUT_ESTIMATOR_UNIT_MS,
			);
			expect(result.coldStartGraceMs).toBe(COLD_START_GRACE_MS);
			expect(result.appliedMs).toBe(
				TIMEOUT_ESTIMATOR_BASE_MS +
					TIMEOUT_ESTIMATOR_UNIT_MS +
					COLD_START_GRACE_MS,
			);
			expect(result.warnings).toEqual([
				expect.stringContaining(`Cold-start grace +${COLD_START_GRACE_MS}ms`),
			]);
		});

		it('still clamps to MAX_EXECUTION_TIMEOUT_MS when grace would exceed the ceiling', () => {
			// 28-weight call: base + 56000 = 61000ms, already past the ceiling;
			// grace cannot push appliedMs above MAX.
			const result = estimateTimeoutMs(
				ast('await api.getArchitectureOverview();'),
				{ coldStartGraceMs: COLD_START_GRACE_MS },
			);
			expect(result.coldStartGraceMs).toBe(COLD_START_GRACE_MS);
			expect(result.appliedMs).toBe(MAX_EXECUTION_TIMEOUT_MS);
		});

		it('absorbs grace into the ceiling when grace is the breaching factor', () => {
			// 3 sequential impactAnalysis (weight 8 each) = 24 → 5000 + 24*2000 =
			// 53000ms, which is UNDER the 60000ms ceiling. Adding 10000ms grace
			// would reach 63000ms, so the clamp caps appliedMs at MAX — grace is
			// only partially realized. (The other ceiling test starts already
			// over MAX; this one proves grace itself triggers the clamp.)
			const code = `
				await api.impactAnalysis({ symbolId: 'a' });
				await api.impactAnalysis({ symbolId: 'b' });
				await api.impactAnalysis({ symbolId: 'c' });
			`;
			const result = estimateTimeoutMs(ast(code), {
				coldStartGraceMs: COLD_START_GRACE_MS,
			});
			expect(result.estimatedMs).toBe(53_000);
			expect(result.estimatedMs).toBeLessThan(MAX_EXECUTION_TIMEOUT_MS);
			expect(result.coldStartGraceMs).toBe(COLD_START_GRACE_MS);
			expect(result.appliedMs).toBe(MAX_EXECUTION_TIMEOUT_MS);
		});

		it('bypasses grace entirely when an explicit override is supplied', () => {
			const result = estimateTimeoutMs(ast('await api.ping();'), {
				explicitTimeoutMs: 3000,
				coldStartGraceMs: COLD_START_GRACE_MS,
			});
			expect(result.coldStartGraceMs).toBe(0);
			expect(result.appliedMs).toBe(3000);
			expect(result.warnings).toEqual([]);
		});

		it('defaults coldStartGraceMs to 0 when not supplied (warm path)', () => {
			const result = estimateTimeoutMs(ast('await api.ping();'));
			expect(result.coldStartGraceMs).toBe(0);
			expect(result.appliedMs).toBe(
				TIMEOUT_ESTIMATOR_BASE_MS + TIMEOUT_ESTIMATOR_UNIT_MS,
			);
		});
	});
});
