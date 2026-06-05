/**
 * Cold-start tracker
 *
 * `CodeModeRuntime` is constructed per request, so first-call state cannot live
 * on the runtime instance. This module holds a single process-lifetime flag,
 * shared across every per-request runtime in the parent process, that flips
 * warm after the first successful API round-trip. While cold, the runtime grants
 * the execution an additive timeout grace (see `COLD_START_GRACE_MS`) to absorb
 * connection establishment + upstream warm-up that the static estimator does
 * not model.
 */

export interface ColdStartTracker {
	/** True until the first successful API round-trip has completed. */
	isColdStart(): boolean;
	/** Mark the process warm; subsequent calls to {@link isColdStart} return false. */
	markWarm(): void;
}

export class ProcessColdStartTracker implements ColdStartTracker {
	private warm = false;

	isColdStart(): boolean {
		return !this.warm;
	}

	markWarm(): void {
		this.warm = true;
	}
}

/** Shared across all per-request CodeModeRuntime instances in this process. */
export const coldStartTracker: ColdStartTracker = new ProcessColdStartTracker();
