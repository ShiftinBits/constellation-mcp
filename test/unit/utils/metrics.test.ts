/**
 * Metrics Unit Tests (SB-258 Step 3.5)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Metrics } from '../../../src/utils/metrics.js';

describe('Metrics', () => {
	beforeEach(() => {
		Metrics.reset();
	});

	describe('singleton', () => {
		it('should return the same instance', () => {
			const a = Metrics.get();
			const b = Metrics.get();
			expect(a).toBe(b);
		});

		it('should return a fresh instance after reset', () => {
			const a = Metrics.get();
			a.increment('test');
			Metrics.reset();
			const b = Metrics.get();
			expect(b.getSnapshot().executions).toBe(0);
		});
	});

	describe('increment', () => {
		it('should increment a counter from zero', () => {
			const m = Metrics.get();
			m.increment('executions');
			expect(m.getSnapshot().executions).toBe(1);
		});

		it('should increment a counter multiple times', () => {
			const m = Metrics.get();
			m.increment('executions');
			m.increment('executions');
			m.increment('executions');
			expect(m.getSnapshot().executions).toBe(3);
		});

		it('should track multiple counters independently', () => {
			const m = Metrics.get();
			m.increment('executions');
			m.increment('errors');
			m.increment('errors');
			m.increment('api_calls');
			m.increment('api_calls');
			m.increment('api_calls');
			const snap = m.getSnapshot();
			expect(snap.executions).toBe(1);
			expect(snap.errors).toBe(2);
			expect(snap.apiCalls).toBe(3);
		});
	});

	describe('recordDuration', () => {
		it('should record duration values', () => {
			const m = Metrics.get();
			m.recordDuration('execution_duration', 100);
			m.recordDuration('execution_duration', 200);
			expect(m.getSnapshot().durations).toEqual([100, 200]);
		});
	});

	describe('getSnapshot', () => {
		it('should return zeros for empty metrics', () => {
			const snap = Metrics.get().getSnapshot();
			expect(snap).toEqual({
				executions: 0,
				errors: 0,
				apiCalls: 0,
				validationFailures: 0,
				avgDuration: 0,
				p95Duration: 0,
				durations: [],
			});
		});

		it('should calculate average duration correctly', () => {
			const m = Metrics.get();
			m.recordDuration('execution_duration', 100);
			m.recordDuration('execution_duration', 200);
			m.recordDuration('execution_duration', 300);
			expect(m.getSnapshot().avgDuration).toBe(200);
		});

		it('should calculate p95 duration correctly', () => {
			const m = Metrics.get();
			// Add 100 values: 1, 2, 3, ..., 100
			for (let i = 1; i <= 100; i++) {
				m.recordDuration('execution_duration', i);
			}
			// p95 of 1..100 should be 95
			expect(m.getSnapshot().p95Duration).toBe(95);
		});

		it('should handle single duration value', () => {
			const m = Metrics.get();
			m.recordDuration('execution_duration', 42);
			const snap = m.getSnapshot();
			expect(snap.avgDuration).toBe(42);
			expect(snap.p95Duration).toBe(42);
		});

		it('should track validation failures', () => {
			const m = Metrics.get();
			m.increment('validation_failures');
			m.increment('validation_failures');
			expect(m.getSnapshot().validationFailures).toBe(2);
		});
	});
});
