/**
 * Language Registry — pure helpers for the file-path language guard.
 *
 * `extractExtension` parses a filePath argument into a normalized lowercase
 * extension (with leading dot) or returns null when the input has no
 * meaningful extension. `resolveConfiguredExtensions` flattens the project's
 * constellation.json language config into a Set for fast membership checks.
 */
import { UnsupportedLanguageError } from '../client/constellation-client.js';
import type { ConstellationConfig } from '../config/config.js';

const EXTENSION_SHAPE = /^\.[a-z0-9_+-]+$/;

/**
 * Extract a normalized file extension from a filePath argument.
 *
 * Returns null when the path has no meaningful extension (directory,
 * extensionless file, dotfile, trailing-dot, or anything the shape check
 * rejects). A null return means the guard should pass the call through.
 */
export function extractExtension(filePath: string): string | null {
	let p = filePath.trim();
	if (p.length === 0) return null;

	// Reject paths containing a NUL byte. Without this check, a path like
	// `foo.py\x00.ts` would extract `.ts` (since lastIndexOf('.') resolves
	// past the NUL) and pass the guard despite the actual semantic extension
	// being `.py`. Path layers further down the stack vary in how they treat
	// embedded NULs, so a same-realm rejection is the safest contract.
	if (p.includes('\x00')) return null;

	const queryIdx = p.indexOf('?');
	if (queryIdx >= 0) p = p.slice(0, queryIdx);
	const fragIdx = p.indexOf('#');
	if (fragIdx >= 0) p = p.slice(0, fragIdx);

	const lastSlash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
	let basename = lastSlash >= 0 ? p.slice(lastSlash + 1) : p;

	basename = basename.trimEnd().toLowerCase();
	if (basename.length === 0) return null;

	const lastDot = basename.lastIndexOf('.');
	if (lastDot < 0) return null;

	if (basename.startsWith('.') && basename.indexOf('.', 1) < 0) return null;

	const ext = basename.slice(lastDot);
	if (ext === '.') return null;
	if (!EXTENSION_SHAPE.test(ext)) return null;

	return ext;
}

/**
 * Flatten the project's configured language fileExtensions into a
 * lowercase, dot-prefixed Set for fast membership checks.
 *
 * Defensive normalization: trims whitespace, lowercases, and prepends '.'
 * if missing. The CLI rejects bare extensions at config-load time, but we
 * normalize here so guard behavior is well-defined even on configs that
 * bypass CLI validation.
 *
 * Returns an empty Set when languages is missing or empty — the guard
 * treats an empty Set as "guard disabled, pass everything through."
 * Note: in production this empty path is unreachable because
 * `ConstellationConfig.validate()` rejects configs with no languages or
 * empty fileExtensions arrays. The empty-Set fallback exists for tests,
 * mocks, and configs constructed without going through `fromJSON`.
 */
export function resolveConfiguredExtensions(
	config: ConstellationConfig,
): ReadonlySet<string> {
	const out = new Set<string>();
	const languages = config.languages ?? {};
	for (const lang of Object.values(languages)) {
		if (!lang?.fileExtensions) continue;
		for (const raw of lang.fileExtensions) {
			if (typeof raw !== 'string') continue;
			let ext = raw.trim().toLowerCase();
			if (ext.length === 0) continue;
			if (!ext.startsWith('.')) ext = '.' + ext;
			out.add(ext);
		}
	}
	return out;
}

/**
 * Set of api method names whose params accept `filePath`. The Proxy in
 * sandbox.ts wraps these (and only these) with `withFilePathLanguageGuard`.
 *
 * Intentionally NOT guarded:
 * - `findOrphanedCode` — takes `filePattern` (a glob), not `filePath`.
 *   Glob expansion is out of scope.
 * - `searchSymbols` — accepts a free-form `query` string, never a file
 *   path. Sniffing query strings would catastrophically false-positive
 *   when TS code legitimately references foreign extensions in symbol
 *   names or strings (e.g., parser/indexer code).
 * - `getArchitectureOverview`, `ping`, `getCapabilities`, `listMethods`,
 *   `help` — no file-scoped params.
 */
export const GUARDED_METHODS: ReadonlySet<string> = new Set([
	'getDependencies',
	'getDependents',
	'findCircularDependencies',
	'getSymbolDetails',
	'getCallGraph',
	'traceSymbolUsage',
	'impactAnalysis',
]);

/**
 * Higher-order wrapper that rejects calls whose `params.filePath` has an
 * extension not present in `configuredExtensions`.
 *
 * Throws `UnsupportedLanguageError` BEFORE invoking `fn`, so the wrapped
 * api method never reaches HTTP and the executor's catch is never entered.
 *
 * Pass-through (no rejection) when:
 *  - `params` is null/undefined (defensive)
 *  - `params.filePath` is not a string or is empty
 *  - `extractExtension(filePath)` returns null (extensionless / weird input)
 *  - `configuredExtensions` is empty (unconfigured project — guard disabled)
 */
export function withFilePathLanguageGuard<P, R>(
	fn: (params: P) => Promise<R>,
	configuredExtensions: ReadonlySet<string>,
): (params: P) => Promise<R> {
	// Note: configuredExtensions stays as a Set in this closure because the
	// wrapper runs in-realm and benefits from O(1) `.has()`. The Set is
	// passed into UnsupportedLanguageError, which converts it to a sorted
	// array internally because the error must survive the vm realm boundary
	// (Set instances lose their prototype after vm.runInContext rejection
	// unwrap; arrays survive intact). See UnsupportedLanguageError.
	return async (params: P) => {
		if (configuredExtensions.size > 0 && params != null) {
			const fp = (params as { filePath?: unknown }).filePath;
			if (typeof fp === 'string' && fp.length > 0) {
				const ext = extractExtension(fp);
				if (ext !== null && !configuredExtensions.has(ext)) {
					throw new UnsupportedLanguageError(fp, ext, configuredExtensions);
				}
			}
		}
		return fn(params);
	};
}
