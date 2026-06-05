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
 *
 * The flag is a monotonic write-once boolean, so no lock is needed: if two
 * first-ever executions overlap they may both read `isColdStart() === true` and
 * each receive the grace. That is benign (grace only enlarges the timeout
 * ceiling, it never shortens a successful call) and intentionally not guarded —
 * do not add a lock here.
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
