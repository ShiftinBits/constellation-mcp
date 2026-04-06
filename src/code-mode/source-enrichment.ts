/**
 * Source Snippet Enrichment
 *
 * Enriches MCP API responses by injecting `sourceSnippet` properties
 * into objects containing file/line references. Reads source files
 * from the local filesystem and injects relevant code context.
 *
 * Privacy: Snippets are extracted locally and returned to the local
 * LLM client. They are never transmitted to Constellation Core.
 */

import path from 'path';
import { promises as fs } from 'fs';
import {
	SNIPPET_CONTEXT_LINES,
	SNIPPET_MAX_LINES,
	SNIPPET_TOTAL_BUDGET,
} from '../constants/result-limits.js';

/** Maximum file size to read for snippet extraction (1MB) */
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

/**
 * Options for controlling snippet enrichment behavior.
 */
export interface SnippetEnrichmentOptions {
	/** Number of context lines above/below the referenced range */
	contextLines?: number;
	/** Maximum lines per individual snippet */
	maxLinesPerSnippet?: number;
	/** Total byte budget for all snippets combined */
	totalBudgetBytes?: number;
	/** Whether enrichment is enabled (overrides env var) */
	enabled?: boolean;
}

/**
 * Internal reference collected from response walking.
 */
interface FileReference {
	/** The object to inject sourceSnippet into */
	obj: Record<string, unknown>;
	/** Relative file path from the response */
	filePath: string;
	/** Start line (1-based) */
	lineStart: number;
	/** End line (1-based, inclusive) */
	lineEnd: number;
}

/** File extensions to skip (binary/non-source) */
const BINARY_EXTENSIONS = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.ico',
	'.svg',
	'.webp',
	'.bmp',
	'.woff',
	'.woff2',
	'.ttf',
	'.eot',
	'.otf',
	'.pdf',
	'.zip',
	'.tar',
	'.gz',
	'.bz2',
	'.7z',
	'.rar',
	'.exe',
	'.dll',
	'.so',
	'.dylib',
	'.bin',
	'.dat',
	'.db',
	'.sqlite',
	'.map',
]);

/**
 * Check if a file path should be skipped for enrichment.
 */
export function shouldSkipFile(filePath: string): boolean {
	if (
		filePath.includes('node_modules/') ||
		filePath.includes('node_modules\\')
	) {
		return true;
	}

	if (filePath.endsWith('.min.js') || filePath.endsWith('.min.css')) {
		return true;
	}

	const ext = path.extname(filePath).toLowerCase();
	if (BINARY_EXTENSIONS.has(ext)) {
		return true;
	}

	if (filePath.endsWith('.d.ts')) {
		return true;
	}

	if (filePath.includes('.generated.') || filePath.includes('__generated__')) {
		return true;
	}

	return false;
}

/**
 * Recursively walk a response object tree and collect file references.
 *
 * A file reference is any object with a `filePath` (string) property
 * and at least one of `line`, `lineStart`, or `lineEnd` (number).
 */
export function collectFileReferences(data: unknown): FileReference[] {
	const refs: FileReference[] = [];

	function walk(node: unknown): void {
		if (node === null || node === undefined || typeof node !== 'object') {
			return;
		}

		if (Array.isArray(node)) {
			for (const item of node) {
				walk(item);
			}
			return;
		}

		const obj = node as Record<string, unknown>;

		if (typeof obj.filePath === 'string' && obj.filePath.length > 0) {
			const hasLine = typeof obj.line === 'number';
			const hasLineStart = typeof obj.lineStart === 'number';
			const hasLineEnd = typeof obj.lineEnd === 'number';

			if (hasLine || hasLineStart || hasLineEnd) {
				const lineStart = (hasLineStart ? obj.lineStart : obj.line) as number;
				const lineEnd = (hasLineEnd ? obj.lineEnd : obj.line) as number;

				refs.push({
					obj,
					filePath: obj.filePath as string,
					lineStart,
					lineEnd,
				});
			}
		}

		for (const value of Object.values(obj)) {
			walk(value);
		}
	}

	walk(data);
	return refs;
}

/**
 * Batch-read unique files from disk, returning a map of filePath → lines.
 * Files that are unreadable or should be skipped are silently omitted.
 */
export async function batchReadFiles(
	references: FileReference[],
	projectRoot: string,
): Promise<Map<string, string[]>> {
	const fileCache = new Map<string, string[]>();

	const uniquePaths = new Set<string>();
	for (const ref of references) {
		if (!shouldSkipFile(ref.filePath)) {
			uniquePaths.add(ref.filePath);
		}
	}

	const resolvedRoot = await fs.realpath(path.resolve(projectRoot));
	const readPromises = Array.from(uniquePaths).map(async (filePath) => {
		try {
			const absolutePath = await fs.realpath(
				path.resolve(projectRoot, filePath),
			);

			// Defense-in-depth: prevent path traversal outside project root
			// Uses realpath to resolve symlinks (e.g. macOS /private/tmp)
			if (
				absolutePath !== resolvedRoot &&
				!absolutePath.startsWith(resolvedRoot + path.sep)
			)
				return;

			// Check file size before reading to prevent memory spikes on large files
			const stat = await fs.stat(absolutePath);
			if (stat.size > MAX_FILE_SIZE_BYTES) return;

			const content = await fs.readFile(absolutePath, 'utf-8');
			fileCache.set(filePath, content.split('\n'));
		} catch {
			// Silently skip unreadable/missing files
		}
	});

	await Promise.all(readPromises);
	return fileCache;
}

/**
 * Extract a snippet from cached file lines for a given reference.
 */
export function extractSnippet(
	fileLines: string[],
	lineStart: number,
	lineEnd: number,
	contextLines: number,
	maxLines: number,
): string | null {
	const totalFileLines = fileLines.length;
	if (totalFileLines === 0) return null;

	// 1-based to 0-based, clamped to file bounds
	const rangeStart = Math.max(0, lineStart - 1 - contextLines);
	const rangeEnd = Math.min(totalFileLines, lineEnd + contextLines);

	if (rangeStart >= totalFileLines || rangeEnd <= 0) return null;

	let snippetLines = fileLines.slice(rangeStart, rangeEnd);
	if (snippetLines.length > maxLines) {
		snippetLines = snippetLines.slice(0, maxLines);
	}

	const snippet = snippetLines.join('\n');
	return snippet.length > 0 ? snippet : null;
}

/**
 * Inject sourceSnippet properties into collected references.
 * Tracks cumulative bytes and stops when budget is exhausted.
 *
 * @returns Total bytes of snippets injected
 */
export function injectSnippets(
	references: FileReference[],
	fileCache: Map<string, string[]>,
	options: Required<
		Pick<
			SnippetEnrichmentOptions,
			'contextLines' | 'maxLinesPerSnippet' | 'totalBudgetBytes'
		>
	>,
): number {
	let totalBytes = 0;

	for (const ref of references) {
		const fileLines = fileCache.get(ref.filePath);
		if (!fileLines) continue;

		const snippet = extractSnippet(
			fileLines,
			ref.lineStart,
			ref.lineEnd,
			options.contextLines,
			options.maxLinesPerSnippet,
		);

		if (snippet === null) continue;

		const snippetBytes = Buffer.byteLength(snippet, 'utf-8');
		if (totalBytes + snippetBytes > options.totalBudgetBytes) break;

		ref.obj.sourceSnippet = snippet;
		totalBytes += snippetBytes;
	}

	return totalBytes;
}

/**
 * Check if source snippet enrichment is enabled.
 * Enabled by default; set CONSTELLATION_INCLUDE_SNIPPETS=false to disable.
 */
function isEnrichmentEnabled(options?: SnippetEnrichmentOptions): boolean {
	if (options?.enabled !== undefined) {
		return options.enabled;
	}

	const envValue = process.env.CONSTELLATION_INCLUDE_SNIPPETS;
	if (envValue !== undefined && envValue.toLowerCase() === 'false') {
		return false;
	}

	return true;
}

/**
 * Enrich MCP API response data with source snippets.
 *
 * Recursively walks the response object tree, finds file/line references,
 * batch-reads the corresponding source files, and injects `sourceSnippet`
 * properties with the relevant code context.
 *
 * @param data - The executor response data (result.data)
 * @param projectRoot - Absolute path to the project root (for resolving relative file paths)
 * @param options - Optional enrichment configuration
 * @returns The enriched data (mutated in place, also returned for convenience)
 */
export async function enrichWithSourceSnippets<T>(
	data: T,
	projectRoot: string,
	options?: SnippetEnrichmentOptions,
): Promise<T> {
	if (!isEnrichmentEnabled(options)) {
		return data;
	}

	if (data === null || data === undefined || typeof data !== 'object') {
		return data;
	}

	const references = collectFileReferences(data);
	if (references.length === 0) {
		return data;
	}

	const fileCache = await batchReadFiles(references, projectRoot);
	if (fileCache.size === 0) {
		return data;
	}

	injectSnippets(references, fileCache, {
		contextLines: options?.contextLines ?? SNIPPET_CONTEXT_LINES,
		maxLinesPerSnippet: options?.maxLinesPerSnippet ?? SNIPPET_MAX_LINES,
		totalBudgetBytes: options?.totalBudgetBytes ?? SNIPPET_TOTAL_BUDGET,
	});

	return data;
}
