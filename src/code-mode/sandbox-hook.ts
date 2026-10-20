/**
 * Sandbox `hook` global
 *
 * Builds the read-only `hook` object a hook-mode program sees. Kept free of
 * zod and other parent-only dependencies because the hardened worker bundle
 * imports it through `sandbox.ts`.
 */

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

/** The `hook` global exposed to a hook-mode program. */
export interface SandboxHookGlobal {
	readonly event: HookEvent;
	readonly input: unknown;
	readonly sessionId?: string;
	readonly settings: Readonly<HookSettings>;
	/**
	 * True the first time `key` is seen for this session (and records it as
	 * newly claimed), false afterwards. Always true without a `sessionId`.
	 */
	once(key: string): boolean;
}

function deepFreeze<T>(value: T): T {
	if (typeof value === 'object' && value !== null) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

/**
 * Create the deep-frozen `hook` global. Keys newly claimed through `once` are
 * added to `newlyClaimed` so the caller can return them to the parent.
 */
export function createSandboxHookGlobal(
	context: SandboxHookContext,
	newlyClaimed: Set<string>,
): SandboxHookGlobal {
	const data = structuredClone({
		event: context.event,
		input: context.input,
		sessionId: context.sessionId,
		settings: context.settings,
	});
	const { sessionId } = data;
	const claimed = new Set(context.claimed);

	const once = (key: unknown): boolean => {
		if (typeof key !== 'string' || key.length === 0) {
			throw new TypeError('hook.once(key) requires a non-empty string key');
		}
		if (sessionId === undefined) return true;
		if (claimed.has(key) || newlyClaimed.has(key)) return false;
		newlyClaimed.add(key);
		return true;
	};

	return deepFreeze({ ...data, once: Object.freeze(once) });
}
