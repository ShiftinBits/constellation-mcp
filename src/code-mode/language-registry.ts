/**
 * Language Registry — pure helpers for the file-path language guard.
 *
 * `extractExtension` parses a filePath argument into a normalized lowercase
 * extension (with leading dot) or returns null when the input has no
 * meaningful extension. `resolveConfiguredExtensions` flattens the project's
 * constellation.json language config into a Set for fast membership checks.
 */
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
