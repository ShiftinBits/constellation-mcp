/**
 * Structured Monitoring Metrics (SB-258 Step 3.5)
 *
 * In-memory singleton that tracks execution counts, durations, error rates,
 * and API call patterns. Exposed via constellation://metrics MCP resource.
 *
 * Zero overhead — counters and histograms are simple in-memory operations.
 */

/**
 * Snapshot of current metrics state
 */
export interface MetricsSnapshot {
	executions: number;
	errors: number;
	apiCalls: number;
	validationFailures: number;
	avgDuration: number;
	p95Duration: number;
	durations: number[];
}

/**
 * Lightweight metrics singleton for sandbox execution monitoring
 */
export class Metrics {
	private static instance: Metrics;

	private counters = new Map<string, number>();
	private histograms = new Map<string, number[]>();

	private constructor() {}

	/**
	 * Get the singleton instance
	 */
	static get(): Metrics {
		if (!Metrics.instance) {
			Metrics.instance = new Metrics();
		}
		return Metrics.instance;
	}

	/**
	 * Reset all metrics (for testing)
	 */
	static reset(): void {
		Metrics.instance = new Metrics();
	}

	/**
	 * Increment a named counter
	 */
	increment(name: string): void {
		this.counters.set(name, (this.counters.get(name) ?? 0) + 1);
	}

	/**
	 * Record a duration value in a named histogram
	 */
	recordDuration(name: string, ms: number): void {
		const values = this.histograms.get(name) ?? [];
		values.push(ms);
		this.histograms.set(name, values);
	}

	/**
	 * Get a snapshot of all current metrics
	 */
	getSnapshot(): MetricsSnapshot {
		const durations = this.histograms.get('execution_duration') ?? [];
		return {
			executions: this.counters.get('executions') ?? 0,
			errors: this.counters.get('errors') ?? 0,
			apiCalls: this.counters.get('api_calls') ?? 0,
			validationFailures: this.counters.get('validation_failures') ?? 0,
			avgDuration: this.average(durations),
			p95Duration: this.percentile(durations, 95),
			durations,
		};
	}

	private average(values: number[]): number {
		if (values.length === 0) return 0;
		return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
	}

	private percentile(values: number[], pct: number): number {
		if (values.length === 0) return 0;
		const sorted = [...values].sort((a, b) => a - b);
		const index = Math.ceil((pct / 100) * sorted.length) - 1;
		return sorted[Math.max(0, index)];
	}
}
