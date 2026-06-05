/**
 * Cold-start tracker unit tests
 *
 * Verifies the process-lifetime warm flag that gates the first-call timeout
 * grace. Deterministic, no I/O.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
	ProcessColdStartTracker,
	coldStartTracker,
} from '../../../src/code-mode/cold-start-tracker.js';

describe('ProcessColdStartTracker', () => {
	it('starts cold', () => {
		const tracker = new ProcessColdStartTracker();
		expect(tracker.isColdStart()).toBe(true);
	});

	it('is warm after markWarm()', () => {
		const tracker = new ProcessColdStartTracker();
		tracker.markWarm();
		expect(tracker.isColdStart()).toBe(false);
	});

	it('stays warm across repeated markWarm() calls', () => {
		const tracker = new ProcessColdStartTracker();
		tracker.markWarm();
		tracker.markWarm();
		expect(tracker.isColdStart()).toBe(false);
	});
});

describe('coldStartTracker singleton', () => {
	it('is a ProcessColdStartTracker so it inherits the start-cold contract', () => {
		// Order-independent: the class tests above prove ProcessColdStartTracker
		// starts cold; this proves the exported singleton IS that class.
		expect(coldStartTracker).toBeInstanceOf(ProcessColdStartTracker);
	});

	it('starts cold on a fresh module load so the first call gets grace', () => {
		// Re-import in isolation so the assertion holds regardless of whether any
		// other test in this worker has touched the live singleton.
		let fresh: { isColdStart(): boolean } | undefined;
		jest.isolateModules(() => {
			fresh = (
				require('../../../src/code-mode/cold-start-tracker.js') as {
					coldStartTracker: { isColdStart(): boolean };
				}
			).coldStartTracker;
		});
		expect(fresh?.isColdStart()).toBe(true);
	});
});
