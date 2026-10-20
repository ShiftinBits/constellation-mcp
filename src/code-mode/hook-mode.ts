/**
 * Hook mode
 *
 * Agent-plugin hooks (for example Codex `mcp_tool` hooks) call `code_intel`
 * with an opt-in `hook` input and expect a hook-output object back instead of
 * the normal result envelope. This module owns the parent-side pieces of that
 * mode: validating the hook request, resolving the requested settings, the
 * per-session `once` key store, and mapping a program result onto the
 * advisory-only hook output (no decision, block or rewrite fields).
 */

import { z } from 'zod';
import {
	HOOK_ONCE_MAX_KEYS,
	HOOK_ONCE_MAX_SESSIONS,
	MAX_HOOK_CONTEXT_CHARS,
	MAX_HOOK_INPUT_BYTES,
	MAX_HOOK_MESSAGE_CHARS,
} from '../constants/index.js';

export const HOOK_EVENTS = [
	'PreToolUse',
	'PostToolUse',
	'SessionStart',
	'SubagentStart',
	'UserPromptSubmit',
	'Stop',
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

/** Requested setting names mapped to their parent-resolved env values. */
export type HookSettings = Record<string, string | undefined>;

/** Hook input as received from the tool caller, before validation. */
export interface RawHookRequest {
	event: string;
	input?: unknown;
	sessionId?: string;
	settings?: string[];
}

/** A validated hook request, ready to hand to the runtime. */
export interface HookRequest {
	event: HookEvent;
	/** JSON round-tripped, so it is plain data that clones and serializes safely. */
	input: unknown;
	sessionId?: string;
	settings: HookSettings;
}

export type ParseHookRequestResult =
	| { ok: true; request: HookRequest }
	| { ok: false; reason: string };

const SETTING_NAME_PATTERN = /^CONSTELLATION_[A-Z0-9_]+$/;
const ACCESS_KEY_SETTING = 'CONSTELLATION_ACCESS_KEY';

function isHookEvent(value: string): value is HookEvent {
	return (HOOK_EVENTS as readonly string[]).includes(value);
}

/**
 * Resolve requested setting names against `env`. Names that do not match
 * `CONSTELLATION_*` and the access key are dropped (logged to stderr), so a
 * hook program can never read credentials or unrelated environment.
 */
export function resolveHookSettings(
	names: readonly string[] = [],
	env: NodeJS.ProcessEnv = process.env,
): HookSettings {
	const settings: HookSettings = {};
	for (const name of names) {
		if (!SETTING_NAME_PATTERN.test(name)) {
			console.error(
				`[code_intel] hook: dropped malformed setting name ${JSON.stringify(name)}`,
			);
			continue;
		}
		if (name === ACCESS_KEY_SETTING) {
			console.error(`[code_intel] hook: dropped setting ${ACCESS_KEY_SETTING}`);
			continue;
		}
		settings[name] = env[name];
	}
	return settings;
}

/**
 * Validate a raw hook request. Fails (with a reason for the stderr log) on an
 * unknown event or an input that is not JSON-serializable or exceeds
 * {@link MAX_HOOK_INPUT_BYTES}. Disallowed setting names are dropped, not
 * failed.
 */
export function parseHookRequest(
	raw: RawHookRequest,
	env: NodeJS.ProcessEnv = process.env,
): ParseHookRequestResult {
	if (!isHookEvent(raw.event)) {
		return {
			ok: false,
			reason: `unknown event ${JSON.stringify(raw.event)}`,
		};
	}

	let serialized: string | undefined;
	try {
		serialized = JSON.stringify(raw.input ?? null);
	} catch {
		return { ok: false, reason: 'input is not JSON-serializable' };
	}
	if (typeof serialized !== 'string') {
		return { ok: false, reason: 'input is not JSON-serializable' };
	}
	const inputBytes = Buffer.byteLength(serialized);
	if (inputBytes > MAX_HOOK_INPUT_BYTES) {
		return {
			ok: false,
			reason: `input is ${inputBytes} bytes (max ${MAX_HOOK_INPUT_BYTES})`,
		};
	}

	const sessionId =
		typeof raw.sessionId === 'string' && raw.sessionId.length > 0
			? raw.sessionId
			: undefined;

	return {
		ok: true,
		request: {
			event: raw.event,
			input: JSON.parse(serialized) as unknown,
			...(sessionId !== undefined ? { sessionId } : {}),
			settings: resolveHookSettings(raw.settings, env),
		},
	};
}

/**
 * Keys already shown once per hook session, so a hook program can emit a
 * notice a single time per session via `hook.once(key)`.
 */
export interface HookOnceStore {
	/** Snapshot of the keys already claimed for `sessionId`. */
	claimed(sessionId: string): ReadonlySet<string>;
	/** Record `keys` as claimed for `sessionId`. */
	commit(sessionId: string, keys: readonly string[]): void;
}

function deleteOldest<T>(items: Set<T> | Map<T, unknown>): void {
	const oldest = items.keys().next();
	if (!oldest.done) items.delete(oldest.value);
}

/**
 * In-process store bounded to {@link HOOK_ONCE_MAX_SESSIONS} sessions of
 * {@link HOOK_ONCE_MAX_KEYS} keys each. A commit makes its session the most
 * recent; the least recently committed session and the oldest key are
 * evicted first.
 *
 * Holding this in process memory is fine here: the stdio server runs one
 * process per client, so every call of a session reaches the same store.
 */
export class BoundedHookOnceStore implements HookOnceStore {
	private readonly sessions = new Map<string, Set<string>>();

	claimed(sessionId: string): ReadonlySet<string> {
		return new Set(this.sessions.get(sessionId));
	}

	commit(sessionId: string, keys: readonly string[]): void {
		if (keys.length === 0) return;

		const sessionKeys = this.sessions.get(sessionId) ?? new Set<string>();
		this.sessions.delete(sessionId);
		this.sessions.set(sessionId, sessionKeys);

		for (const key of keys) {
			sessionKeys.delete(key);
			sessionKeys.add(key);
		}
		while (sessionKeys.size > HOOK_ONCE_MAX_KEYS) deleteOldest(sessionKeys);
		while (this.sessions.size > HOOK_ONCE_MAX_SESSIONS) {
			deleteOldest(this.sessions);
		}
	}
}

/** Shared across all hook-mode calls in this process. */
export const hookOnceStore: HookOnceStore = new BoundedHookOnceStore();

/** The only output shape hook mode can produce. */
export const HookOutputSchema = z
	.object({
		hookSpecificOutput: z
			.object({
				hookEventName: z.enum(HOOK_EVENTS),
				additionalContext: z.string(),
			})
			.strict()
			.optional(),
		systemMessage: z.string().optional(),
	})
	.strict();

export type HookOutput = z.infer<typeof HookOutputSchema>;

/**
 * Map a hook program's result onto {@link HookOutput}. Only a string
 * `context` (as `additionalContext`, never for `Stop`) and the first line of
 * a string `message` (as `systemMessage`) survive, each capped; every other
 * field is dropped.
 */
export function buildHookOutput(event: HookEvent, value: unknown): HookOutput {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return {};
	}
	const { context, message } = value as Record<string, unknown>;
	const output: HookOutput = {};

	if (event !== 'Stop' && typeof context === 'string' && context.length > 0) {
		output.hookSpecificOutput = {
			hookEventName: event,
			additionalContext: context.slice(0, MAX_HOOK_CONTEXT_CHARS),
		};
	}

	if (typeof message === 'string') {
		const firstLine = message
			.split(/\r?\n/, 1)[0]
			.trim()
			.slice(0, MAX_HOOK_MESSAGE_CHARS);
		if (firstLine.length > 0) output.systemMessage = firstLine;
	}

	return output;
}
