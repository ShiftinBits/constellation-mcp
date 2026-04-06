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
import { FileUtils } from '../utils/file.utils.js';
import {
	SNIPPET_CONTEXT_LINES,
	SNIPPET_MAX_LINES,
	SNIPPET_TOTAL_BUDGET,
} from '../constants/result-limits.js';

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
]);

/**
 * Check if a file path should be skipped for enrichment.
 */
export function shouldSkipFile(filePath: string): boolean {
	// Skip node_modules
	if (
		filePath.includes('node_modules/') ||
		filePath.includes('node_modules\\')
	) {
		return true;
	}

	// Skip minified files
	if (filePath.endsWith('.min.js') || filePath.endsWith('.min.css')) {
		return true;
	}

	// Skip binary files by extension
	const ext = path.extname(filePath).toLowerCase();
	if (BINARY_EXTENSIONS.has(ext)) {
		return true;
	}

	// Skip generated files
	if (
		filePath.includes('.generated.') ||
		filePath.includes('.g.') ||
		filePath.includes('__generated__')
	) {
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

		// Check if this object has file location properties
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

		// Recurse into all object values (including nested objects and arrays)
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

	// Collect unique file paths
	const uniquePaths = new Set<string>();
	for (const ref of references) {
		if (!shouldSkipFile(ref.filePath)) {
			uniquePaths.add(ref.filePath);
		}
	}

	// Read files in parallel
	const readPromises = Array.from(uniquePaths).map(async (filePath) => {
		try {
			const absolutePath = path.resolve(projectRoot, filePath);
			const isReadable = await FileUtils.fileIsReadable(absolutePath);
			if (!isReadable) return;

			const content = await FileUtils.readFile(absolutePath);
			fileCache.set(filePath, content.split('\n'));
		} catch {
			// Graceful fallback — silently skip unreadable files
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

	// Convert to 0-based and clamp to file bounds
	const rangeStart = Math.max(0, lineStart - 1 - contextLines);
	const rangeEnd = Math.min(totalFileLines, lineEnd + contextLines);

	if (rangeStart >= totalFileLines || rangeEnd <= 0) return null;

	// Extract lines and enforce per-snippet cap
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
		// Stop if budget exhausted
		if (totalBytes >= options.totalBudgetBytes) break;

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

		// Check if adding this snippet would exceed budget
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
	// Explicit option takes precedence
	if (options?.enabled !== undefined) {
		return options.enabled;
	}

	// Check environment variable
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
	// Check if enrichment is enabled
	if (!isEnrichmentEnabled(options)) {
		return data;
	}

	// Skip non-object data (primitives, null, undefined)
	if (data === null || data === undefined || typeof data !== 'object') {
		return data;
	}

	// Collect all file references from the response tree
	const references = collectFileReferences(data);
	if (references.length === 0) {
		return data;
	}

	// Batch-read unique source files
	const fileCache = await batchReadFiles(references, projectRoot);
	if (fileCache.size === 0) {
		return data;
	}

	// Inject snippets with budget tracking
	injectSnippets(references, fileCache, {
		contextLines: options?.contextLines ?? SNIPPET_CONTEXT_LINES,
		maxLinesPerSnippet: options?.maxLinesPerSnippet ?? SNIPPET_MAX_LINES,
		totalBudgetBytes: options?.totalBudgetBytes ?? SNIPPET_TOTAL_BUDGET,
	});

	return data;
}
