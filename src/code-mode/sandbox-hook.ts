/**
 * Sandbox `hook` global
 *
 * Installs the read-only `hook` object a hook-mode program sees. Kept free of
 * zod and other parent-only dependencies because the hardened worker bundle
 * imports it through `sandbox.ts`.
 */

import vm from 'vm';
import {
	HOOK_ONCE_MAX_KEY_CHARS,
	HOOK_ONCE_MAX_KEYS,
} from '../constants/sandbox-limits.js';
import type { HookEvent, HookSettings } from './hook-mode.js';

/**
 * Hook context handed from the parent to the sandbox. Plain serializable
 * data, so it can cross the hardened worker's IPC channel unchanged.
 */
export interface SandboxHookContext {
	event: HookEvent;
	input: unknown;
	sessionId?: string;
	/** Already resolved by the parent; the sandbox never reads env itself. */
	settings: HookSettings;
	/** Keys the parent store has already claimed for `sessionId`. */
	claimed: string[];
}

/**
 * Builds the hook inside the context realm from a JSON string, so every
 * object reachable from `hook` (including `once`) has the context's frozen
 * built-in prototypes and no host-realm object leaks in. Defines `hook` as a
 * non-writable, non-configurable global and returns a function that reports
 * the newly claimed keys as a JSON string.
 *
 * It runs before the program, after the context's prototypes are frozen.
 * `once` and the returned reader use only frozen built-ins (Set methods,
 * JSON) and plain indexing, never iterators, so the program cannot hook into
 * them.
 */
const HOOK_BUILDER_SOURCE = `(function (json) {
	"use strict";
	const data = JSON.parse(json);
	const deepFreeze = (value) => {
		if (typeof value === "object" && value !== null) {
			Object.freeze(value);
			for (const child of Object.values(value)) deepFreeze(child);
		}
		return value;
	};
	const sessionId = data.sessionId;
	const claimed = new Set(data.claimed);
	const newlyClaimed = new Set();
	const newlyClaimedList = [];
	// Method shorthand: no own \`prototype\` and not constructible.
	const hook = {
		event: data.event,
		input: data.input,
		sessionId,
		settings: data.settings,
		once(key) {
			if (typeof key !== "string" || key.length === 0) {
				throw new TypeError("hook.once(key) requires a non-empty string key");
			}
			if (key.length > ${HOOK_ONCE_MAX_KEY_CHARS}) {
				throw new TypeError("hook.once(key) key exceeds ${HOOK_ONCE_MAX_KEY_CHARS} characters");
			}
			if (sessionId === undefined) return true;
			if (claimed.has(key) || newlyClaimed.has(key)) return false;
			// The store keeps at most this many keys per session, so more
			// claims in one run would be evicted at once.
			if (newlyClaimedList.length >= ${HOOK_ONCE_MAX_KEYS}) return false;
			newlyClaimed.add(key);
			newlyClaimedList[newlyClaimedList.length] = key;
			return true;
		},
	};
	Object.freeze(hook.once);
	deepFreeze(hook);
	Object.defineProperty(globalThis, "hook", {
		value: hook,
		writable: false,
		enumerable: false,
		configurable: false,
	});
	return () => JSON.stringify(newlyClaimedList);
})`;

/**
 * Define the deep-frozen `hook` global in `context`. Must run after the
 * context's built-in prototypes are frozen and before the program. Returns a
 * reader for the keys newly claimed through `hook.once(key)`.
 */
export function installSandboxHook(
	context: vm.Context,
	hook: SandboxHookContext,
): () => string[] {
	const build = vm.runInContext(HOOK_BUILDER_SOURCE, context) as (
		json: string,
	) => () => string;
	const readClaimed = build(
		JSON.stringify({
			event: hook.event,
			input: hook.input,
			sessionId: hook.sessionId,
			settings: hook.settings,
			claimed: hook.claimed,
		}),
	);
	return () => JSON.parse(readClaimed()) as string[];
}
