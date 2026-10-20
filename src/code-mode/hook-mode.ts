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
	HOOK_MAX_SESSION_ID_CHARS,
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

/**
 * Hook input as received from the tool caller, before validation. Only the
 * object shape is enforced by the tool schema; every field is checked here so
 * a malformed value is quiet instead of a tool error.
 */
export interface RawHookRequest {
	event?: unknown;
	input?: unknown;
	sessionId?: unknown;
	settings?: unknown;
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
/** Longest caller-controlled value echoed into a stderr log line. */
const MAX_LOGGED_VALUE_CHARS = 100;

function isHookEvent(value: unknown): value is HookEvent {
	return (HOOK_EVENTS as readonly unknown[]).includes(value);
}

/** A caller-controlled string, truncated and quoted for a stderr log line. */
function logValue(value: string): string {
	return JSON.stringify(
		value.length > MAX_LOGGED_VALUE_CHARS
			? `${value.slice(0, MAX_LOGGED_VALUE_CHARS)}...`
			: value,
	);
}

/**
 * Keep a non-empty string `sessionId` of at most
 * {@link HOOK_MAX_SESSION_ID_CHARS}; anything else is treated as absent, and
 * a non-string or over-long value is logged.
 */
function parseSessionId(value: unknown): string | undefined {
	if (value === undefined || value === '') return undefined;
	if (typeof value !== 'string') {
		console.error(
			`[code_intel] hook: ignored sessionId of type ${typeof value}`,
		);
		return undefined;
	}
	if (value.length > HOOK_MAX_SESSION_ID_CHARS) {
		console.error(
			`[code_intel] hook: ignored sessionId of ${value.length} chars (max ${HOOK_MAX_SESSION_ID_CHARS}) ${logValue(value)}`,
		);
		return undefined;
	}
	return value;
}

/** Requested setting names; a non-array value requests none (logged). */
function parseSettingNames(value: unknown): readonly unknown[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		console.error(
			`[code_intel] hook: ignored settings of type ${typeof value}`,
		);
		return [];
	}
	return value;
}

/**
 * Resolve requested setting names against `env`. Non-string names, names
 * that do not match `CONSTELLATION_*` and the access key are dropped (logged
 * to stderr), so a hook program can never read credentials or unrelated
 * environment.
 */
export function resolveHookSettings(
	names: readonly unknown[] = [],
	env: NodeJS.ProcessEnv = process.env,
): HookSettings {
	const settings: HookSettings = {};
	for (const name of names) {
		if (typeof name !== 'string') {
			console.error(
				`[code_intel] hook: dropped setting name of type ${typeof name}`,
			);
			continue;
		}
		if (!SETTING_NAME_PATTERN.test(name)) {
			console.error(
				`[code_intel] hook: dropped malformed setting name ${logValue(name)}`,
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
 * Validate a raw hook request. Fails (with a reason for the stderr log) on a
 * missing or unknown event or an input that is not JSON-serializable or
 * exceeds {@link MAX_HOOK_INPUT_BYTES}. A malformed `sessionId` is treated as
 * absent and malformed settings are dropped, not failed.
 */
export function parseHookRequest(
	raw: RawHookRequest,
	env: NodeJS.ProcessEnv = process.env,
): ParseHookRequestResult {
	if (typeof raw.event !== 'string') {
		return { ok: false, reason: `event of type ${typeof raw.event}` };
	}
	if (!isHookEvent(raw.event)) {
		return { ok: false, reason: `unknown event ${logValue(raw.event)}` };
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

	const sessionId = parseSessionId(raw.sessionId);

	return {
		ok: true,
		request: {
			event: raw.event,
			input: JSON.parse(serialized) as unknown,
			...(sessionId !== undefined ? { sessionId } : {}),
			settings: resolveHookSettings(parseSettingNames(raw.settings), env),
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

/** Slice `text` to `max` UTF-16 units without leaving a lone high surrogate. */
function capChars(text: string, max: number): string {
	if (text.length <= max) return text;
	const capped = text.slice(0, max);
	const last = capped.charCodeAt(capped.length - 1);
	return last >= 0xd800 && last <= 0xdbff ? capped.slice(0, -1) : capped;
}

/**
 * Map a hook program's result onto {@link HookOutput}. Only a string
 * `context` (as `additionalContext`, never for `Stop`) and the first
 * non-blank line of a string `message` (as `systemMessage`) survive, each
 * capped; every other field is dropped.
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
			additionalContext: capChars(context, MAX_HOOK_CONTEXT_CHARS),
		};
	}

	if (typeof message === 'string') {
		const firstLine = message
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find((line) => line.length > 0);
		if (firstLine !== undefined) {
			output.systemMessage = capChars(firstLine, MAX_HOOK_MESSAGE_CHARS);
		}
	}

	return output;
}
