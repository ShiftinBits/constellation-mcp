/**
 * Hook mode unit tests: request parsing, settings resolution, the once-key
 * store and the allowlisted hook-output builder.
 */

import { describe, expect, it } from '@jest/globals';
import {
	BoundedHookOnceStore,
	buildHookOutput,
	HookOutputSchema,
	hookOnceStore,
	parseHookRequest,
	resolveHookSettings,
} from '../../../src/code-mode/hook-mode.js';
import {
	HOOK_ONCE_MAX_KEYS,
	HOOK_ONCE_MAX_SESSIONS,
	MAX_HOOK_CONTEXT_CHARS,
	MAX_HOOK_INPUT_BYTES,
	MAX_HOOK_MESSAGE_CHARS,
} from '../../../src/constants/index.js';

describe('hook mode', () => {
	describe('caps', () => {
		it('should expose the agreed hook-mode limits', () => {
			expect({
				MAX_HOOK_INPUT_BYTES,
				MAX_HOOK_CONTEXT_CHARS,
				MAX_HOOK_MESSAGE_CHARS,
				HOOK_ONCE_MAX_SESSIONS,
				HOOK_ONCE_MAX_KEYS,
			}).toEqual({
				MAX_HOOK_INPUT_BYTES: 262144,
				MAX_HOOK_CONTEXT_CHARS: 8000,
				MAX_HOOK_MESSAGE_CHARS: 300,
				HOOK_ONCE_MAX_SESSIONS: 64,
				HOOK_ONCE_MAX_KEYS: 256,
			});
		});
	});

	describe('parseHookRequest', () => {
		it('should accept a known event and return the validated request', () => {
			const result = parseHookRequest(
				{
					event: 'PostToolUse',
					input: { tool_name: 'Edit', tool_input: { file_path: 'a.ts' } },
					sessionId: 'session-1',
				},
				{},
			);

			expect(result).toEqual({
				ok: true,
				request: {
					event: 'PostToolUse',
					input: { tool_name: 'Edit', tool_input: { file_path: 'a.ts' } },
					sessionId: 'session-1',
					settings: {},
				},
			});
		});

		it('should fail when the event is unknown', () => {
			const result = parseHookRequest({ event: 'Notification' }, {});

			expect(result).toEqual({
				ok: false,
				reason: 'unknown event "Notification"',
			});
		});

		it('should fail when the serialized input exceeds MAX_HOOK_INPUT_BYTES', () => {
			const input = { blob: 'x'.repeat(MAX_HOOK_INPUT_BYTES) };

			const result = parseHookRequest({ event: 'PreToolUse', input }, {});

			expect(result.ok).toBe(false);
			expect(!result.ok && result.reason).toMatch(/^input is \d+ bytes/);
		});

		it('should accept an input of exactly MAX_HOOK_INPUT_BYTES', () => {
			// JSON.stringify of a string adds two quote bytes.
			const input = 'x'.repeat(MAX_HOOK_INPUT_BYTES - 2);

			const result = parseHookRequest({ event: 'PreToolUse', input }, {});

			expect(result.ok).toBe(true);
		});

		it('should fail when the input throws during serialization', () => {
			const result = parseHookRequest(
				{ event: 'PreToolUse', input: { big: BigInt(1) } },
				{},
			);

			expect(result).toEqual({
				ok: false,
				reason: 'input is not JSON-serializable',
			});
		});

		it('should fail when the input serializes to nothing', () => {
			const result = parseHookRequest(
				{ event: 'PreToolUse', input: () => 1 },
				{},
			);

			expect(result).toEqual({
				ok: false,
				reason: 'input is not JSON-serializable',
			});
		});

		it('should normalize a missing input to null', () => {
			const result = parseHookRequest({ event: 'SessionStart' }, {});

			expect(result.ok && result.request.input).toBeNull();
		});

		it('should omit an empty sessionId', () => {
			const result = parseHookRequest(
				{ event: 'SessionStart', sessionId: '' },
				{},
			);

			expect(result.ok && 'sessionId' in result.request).toBe(false);
		});

		it('should resolve requested settings from the given env', () => {
			const result = parseHookRequest(
				{ event: 'Stop', settings: ['CONSTELLATION_HOOK_MODE'] },
				{ CONSTELLATION_HOOK_MODE: 'quiet' },
			);

			expect(result.ok && result.request.settings).toEqual({
				CONSTELLATION_HOOK_MODE: 'quiet',
			});
		});
	});

	describe('resolveHookSettings', () => {
		it('should map a set setting to its env value', () => {
			const settings = resolveHookSettings(['CONSTELLATION_API_URL'], {
				CONSTELLATION_API_URL: 'https://api.constellationdev.io',
			});

			expect(settings).toEqual({
				CONSTELLATION_API_URL: 'https://api.constellationdev.io',
			});
		});

		it('should map an unset setting to undefined', () => {
			const settings = resolveHookSettings(['CONSTELLATION_UNSET'], {});

			expect('CONSTELLATION_UNSET' in settings).toBe(true);
			expect(settings.CONSTELLATION_UNSET).toBeUndefined();
		});

		it('should drop setting names that are not CONSTELLATION_ upper snake case', () => {
			const settings = resolveHookSettings(
				['HOME', 'constellation_lower', 'CONSTELLATION_', 'CONSTELLATION_A-B'],
				{
					HOME: '/home/user',
					constellation_lower: 'x',
					CONSTELLATION_: 'x',
					'CONSTELLATION_A-B': 'x',
				},
			);

			expect(settings).toEqual({});
		});

		it('should drop CONSTELLATION_ACCESS_KEY even when it is set', () => {
			const settings = resolveHookSettings(
				['CONSTELLATION_ACCESS_KEY', 'CONSTELLATION_DEBUG'],
				{ CONSTELLATION_ACCESS_KEY: 'ak:secret', CONSTELLATION_DEBUG: '1' },
			);

			expect(settings).toEqual({ CONSTELLATION_DEBUG: '1' });
		});

		it('should return no settings when none are requested', () => {
			expect(resolveHookSettings(undefined, {})).toEqual({});
		});
	});

	describe('BoundedHookOnceStore', () => {
		it('should report a key as claimed only after it is committed', () => {
			const store = new BoundedHookOnceStore();

			const before = store.claimed('s1').has('notice');
			store.commit('s1', ['notice']);
			const after = store.claimed('s1').has('notice');

			expect([before, after]).toEqual([false, true]);
		});

		it('should isolate claimed keys per session', () => {
			const store = new BoundedHookOnceStore();

			store.commit('s1', ['notice']);

			expect(store.claimed('s2').has('notice')).toBe(false);
		});

		it('should return a snapshot that does not track later commits', () => {
			const store = new BoundedHookOnceStore();
			store.commit('s1', ['a']);

			const snapshot = store.claimed('s1');
			store.commit('s1', ['b']);

			expect([...snapshot]).toEqual(['a']);
		});

		it('should ignore an empty commit without creating a session', () => {
			const store = new BoundedHookOnceStore();
			for (let i = 0; i < HOOK_ONCE_MAX_SESSIONS; i++) {
				store.commit(`s${i}`, ['k']);
			}

			store.commit('empty', []);

			expect(store.claimed('s0').has('k')).toBe(true);
		});

		it('should evict the least recently committed session beyond HOOK_ONCE_MAX_SESSIONS', () => {
			const store = new BoundedHookOnceStore();
			for (let i = 0; i < HOOK_ONCE_MAX_SESSIONS; i++) {
				store.commit(`s${i}`, ['k']);
			}
			// Re-committing s0 makes s1 the least recently committed session.
			store.commit('s0', ['k2']);

			store.commit('overflow', ['k']);

			expect({
				s0: store.claimed('s0').has('k'),
				s1: store.claimed('s1').has('k'),
				s2: store.claimed('s2').has('k'),
				overflow: store.claimed('overflow').has('k'),
			}).toEqual({ s0: true, s1: false, s2: true, overflow: true });
		});

		it('should evict the oldest key beyond HOOK_ONCE_MAX_KEYS', () => {
			const store = new BoundedHookOnceStore();
			const keys = Array.from(
				{ length: HOOK_ONCE_MAX_KEYS + 1 },
				(_, i) => `k${i}`,
			);

			store.commit('s1', keys);

			const claimed = store.claimed('s1');
			expect(claimed.size).toBe(HOOK_ONCE_MAX_KEYS);
			expect(claimed.has('k0')).toBe(false);
			expect(claimed.has(`k${HOOK_ONCE_MAX_KEYS}`)).toBe(true);
		});

		it('should refresh a re-committed key so it is evicted last', () => {
			const store = new BoundedHookOnceStore();
			const keys = Array.from(
				{ length: HOOK_ONCE_MAX_KEYS },
				(_, i) => `k${i}`,
			);
			store.commit('s1', keys);

			store.commit('s1', ['k0', 'fresh']);

			const claimed = store.claimed('s1');
			expect(claimed.has('k0')).toBe(true);
			expect(claimed.has('k1')).toBe(false);
		});

		it('should export a process-wide default store', () => {
			expect(hookOnceStore).toBeInstanceOf(BoundedHookOnceStore);
		});
	});

	describe('buildHookOutput', () => {
		it('should keep only allowlisted fields when the program returns control fields', () => {
			const value = {
				context: 'Impact: 3 dependents',
				message: 'Constellation: 3 dependents',
				decision: 'block',
				reason: 'nope',
				permissionDecision: 'deny',
				permissionDecisionReason: 'nope',
				continue: false,
				stopReason: 'halt',
				suppressOutput: true,
				updatedInput: { file_path: '/etc/passwd' },
				updatedMCPToolOutput: { result: 'rewritten' },
				hookSpecificOutput: { permissionDecision: 'deny' },
			};

			const output = buildHookOutput('PreToolUse', value);

			expect(output).toStrictEqual({
				hookSpecificOutput: {
					hookEventName: 'PreToolUse',
					additionalContext: 'Impact: 3 dependents',
				},
				systemMessage: 'Constellation: 3 dependents',
			});
			expect(HookOutputSchema.parse(output)).toStrictEqual(output);
		});

		it('should never set additionalContext for Stop', () => {
			const output = buildHookOutput('Stop', {
				context: 'ignored',
				message: 'Done',
			});

			expect(output).toStrictEqual({ systemMessage: 'Done' });
		});

		it('should cap additionalContext at MAX_HOOK_CONTEXT_CHARS', () => {
			const output = buildHookOutput('PostToolUse', {
				context: 'c'.repeat(MAX_HOOK_CONTEXT_CHARS + 50),
			});

			expect(output.hookSpecificOutput?.additionalContext).toHaveLength(
				MAX_HOOK_CONTEXT_CHARS,
			);
		});

		it('should cap systemMessage at MAX_HOOK_MESSAGE_CHARS', () => {
			const output = buildHookOutput('PostToolUse', {
				message: 'm'.repeat(MAX_HOOK_MESSAGE_CHARS + 50),
			});

			expect(output.systemMessage).toHaveLength(MAX_HOOK_MESSAGE_CHARS);
		});

		it('should cut a multi-line message to its trimmed first line', () => {
			const output = buildHookOutput('SessionStart', {
				message: '  first line  \r\nsecond line\nthird',
			});

			expect(output).toStrictEqual({ systemMessage: 'first line' });
		});

		it('should omit a message whose first line is blank', () => {
			const output = buildHookOutput('SessionStart', {
				message: '   \nsecond line',
			});

			expect(output).toStrictEqual({});
		});

		it('should omit an empty context', () => {
			expect(
				buildHookOutput('UserPromptSubmit', { context: '' }),
			).toStrictEqual({});
		});

		it('should ignore non-string context and message fields', () => {
			const output = buildHookOutput('SubagentStart', {
				context: { text: 'object' },
				message: 42,
			});

			expect(output).toStrictEqual({});
		});

		it.each([
			['null', null],
			['undefined', undefined],
			['a string', 'context'],
			['a number', 1],
			['an array', ['context']],
		])('should return an empty output for %s', (_label, value) => {
			expect(buildHookOutput('PostToolUse', value)).toStrictEqual({});
		});
	});

	describe('HookOutputSchema', () => {
		it('should accept the empty output', () => {
			expect(HookOutputSchema.safeParse({}).success).toBe(true);
		});

		it('should reject unknown top-level keys', () => {
			expect(HookOutputSchema.safeParse({ decision: 'block' }).success).toBe(
				false,
			);
		});

		it('should reject unknown hookSpecificOutput keys', () => {
			const result = HookOutputSchema.safeParse({
				hookSpecificOutput: {
					hookEventName: 'PreToolUse',
					additionalContext: 'x',
					permissionDecision: 'deny',
				},
			});

			expect(result.success).toBe(false);
		});
	});
});
