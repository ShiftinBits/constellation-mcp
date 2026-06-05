/**
 * Cold-start tracker unit tests
 *
 * Verifies the process-lifetime warm flag that gates the first-call timeout
 * grace. Deterministic, no I/O.
 */

import { describe, it, expect } from '@jest/globals';
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
	it('exposes the ColdStartTracker contract', () => {
		expect(typeof coldStartTracker.isColdStart).toBe('function');
		expect(typeof coldStartTracker.markWarm).toBe('function');
	});
});
