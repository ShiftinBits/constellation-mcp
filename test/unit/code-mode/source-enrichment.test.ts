/**
 * Source Snippet Enrichment Unit Tests
 */

import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach,
} from '@jest/globals';
import {
	enrichWithSourceSnippets,
	collectFileReferences,
	batchReadFiles,
	extractSnippet,
	injectSnippets,
	shouldSkipFile,
} from '../../../src/code-mode/source-enrichment.js';
import { promises as fs } from 'fs';

// Mock fs to avoid real filesystem access
jest.mock('fs', () => ({
	promises: {
		stat: jest.fn(),
		readFile: jest.fn(),
		realpath: jest.fn(),
	},
}));

const MockedFsStat = fs.stat as jest.MockedFunction<typeof fs.stat>;
const MockedFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const MockedFsRealpath = fs.realpath as unknown as jest.MockedFunction<
	(path: string) => Promise<string>
>;

describe('Source Snippet Enrichment', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		delete process.env.CONSTELLATION_INCLUDE_SNIPPETS;
	});

	afterEach(() => {
		delete process.env.CONSTELLATION_INCLUDE_SNIPPETS;
	});

	// =========================================================================
	// shouldSkipFile
	// =========================================================================

	describe('shouldSkipFile', () => {
		it('should skip node_modules paths', () => {
			expect(shouldSkipFile('node_modules/lodash/index.js')).toBe(true);
			expect(shouldSkipFile('src/node_modules/foo.ts')).toBe(true);
		});

		it('should skip minified files', () => {
			expect(shouldSkipFile('dist/bundle.min.js')).toBe(true);
			expect(shouldSkipFile('styles/app.min.css')).toBe(true);
		});

		it('should skip binary files and source maps', () => {
			expect(shouldSkipFile('assets/logo.png')).toBe(true);
			expect(shouldSkipFile('fonts/arial.woff2')).toBe(true);
			expect(shouldSkipFile('docs/manual.pdf')).toBe(true);
			expect(shouldSkipFile('dist/index.js.map')).toBe(true);
		});

		it('should skip declaration files', () => {
			expect(shouldSkipFile('src/types/api.d.ts')).toBe(true);
			expect(shouldSkipFile('node_modules/@types/node/index.d.ts')).toBe(true);
		});

		it('should skip generated files', () => {
			expect(shouldSkipFile('src/schema.generated.ts')).toBe(true);
			expect(shouldSkipFile('src/__generated__/types.ts')).toBe(true);
		});

		it('should not false-positive on .g. in regular filenames', () => {
			expect(shouldSkipFile('src/config.global.ts')).toBe(false);
			expect(shouldSkipFile('src/string.guard.ts')).toBe(false);
		});

		it('should not skip regular source files', () => {
			expect(shouldSkipFile('src/services/auth.service.ts')).toBe(false);
			expect(shouldSkipFile('src/utils/helpers.js')).toBe(false);
			expect(shouldSkipFile('src/styles/main.css')).toBe(false);
		});
	});

	// =========================================================================
	// collectFileReferences
	// =========================================================================

	describe('collectFileReferences', () => {
		it('should find filePath + line in flat objects', () => {
			const data = { filePath: 'src/foo.ts', line: 10, name: 'foo' };
			const refs = collectFileReferences(data);

			expect(refs).toHaveLength(1);
			expect(refs[0].filePath).toBe('src/foo.ts');
			expect(refs[0].lineStart).toBe(10);
			expect(refs[0].lineEnd).toBe(10);
		});

		it('should find filePath + lineStart/lineEnd in flat objects', () => {
			const data = { filePath: 'src/bar.ts', lineStart: 5, lineEnd: 15 };
			const refs = collectFileReferences(data);

			expect(refs).toHaveLength(1);
			expect(refs[0].lineStart).toBe(5);
			expect(refs[0].lineEnd).toBe(15);
		});

		it('should find references in arrays of objects', () => {
			const data = {
				symbols: [
					{ filePath: 'src/a.ts', line: 1, name: 'a' },
					{ filePath: 'src/b.ts', line: 2, name: 'b' },
				],
			};
			const refs = collectFileReferences(data);

			expect(refs).toHaveLength(2);
			expect(refs[0].filePath).toBe('src/a.ts');
			expect(refs[1].filePath).toBe('src/b.ts');
		});

		it('should find references in deeply nested structures', () => {
			const data = {
				impactedFiles: [
					{
						filePath: 'src/file.ts',
						symbols: [{ id: '1', name: 'fn', kind: 'function', line: 42 }],
					},
				],
			};
			const refs = collectFileReferences(data);

			// impactedFiles[0] has filePath but no line — skipped
			// symbols[0] has line but no filePath — skipped
			expect(refs).toHaveLength(0);
		});

		it('should find references in impactAnalysis nested symbols with filePath', () => {
			const data = {
				directDependents: [
					{
						filePath: 'src/dep.ts',
						line: 10,
						name: 'dep',
						kind: 'function',
						depth: 1,
					},
				],
			};
			const refs = collectFileReferences(data);

			expect(refs).toHaveLength(1);
			expect(refs[0].filePath).toBe('src/dep.ts');
		});

		it('should skip objects without filePath', () => {
			const data = { name: 'foo', line: 10 };
			const refs = collectFileReferences(data);

			expect(refs).toHaveLength(0);
		});

		it('should skip objects with filePath but no line info', () => {
			const data = { filePath: 'src/foo.ts', name: 'foo' };
			const refs = collectFileReferences(data);

			expect(refs).toHaveLength(0);
		});

		it('should handle null, undefined, and primitives', () => {
			expect(collectFileReferences(null)).toHaveLength(0);
			expect(collectFileReferences(undefined)).toHaveLength(0);
			expect(collectFileReferences(42)).toHaveLength(0);
			expect(collectFileReferences('string')).toHaveLength(0);
		});

		it('should handle empty objects and arrays', () => {
			expect(collectFileReferences({})).toHaveLength(0);
			expect(collectFileReferences([])).toHaveLength(0);
		});
	});

	// =========================================================================
	// extractSnippet
	// =========================================================================

	describe('extractSnippet', () => {
		const lines = [
			'line 1', // index 0
			'line 2', // index 1
			'line 3', // index 2
			'line 4', // index 3
			'line 5', // index 4
			'line 6', // index 5
			'line 7', // index 6
			'line 8', // index 7
			'line 9', // index 8
			'line 10', // index 9
		];

		it('should extract lines with context padding', () => {
			// line 5 (1-based) with 2 lines context → lines 3-7
			const snippet = extractSnippet(lines, 5, 5, 2, 50);

			expect(snippet).toBe('line 3\nline 4\nline 5\nline 6\nline 7');
		});

		it('should handle lineStart/lineEnd ranges', () => {
			// lines 3-5 with 1 line context → lines 2-6
			const snippet = extractSnippet(lines, 3, 5, 1, 50);

			expect(snippet).toBe('line 2\nline 3\nline 4\nline 5\nline 6');
		});

		it('should clamp to file bounds at the start', () => {
			// line 1 with 3 lines context → lines 1-4 (can't go before line 1)
			const snippet = extractSnippet(lines, 1, 1, 3, 50);

			expect(snippet).toBe('line 1\nline 2\nline 3\nline 4');
		});

		it('should clamp to file bounds at the end', () => {
			// line 10 with 3 lines context → lines 7-10 (can't go past line 10)
			const snippet = extractSnippet(lines, 10, 10, 3, 50);

			expect(snippet).toBe('line 7\nline 8\nline 9\nline 10');
		});

		it('should enforce per-snippet max lines', () => {
			// lines 1-10 with 0 context, max 3 lines → first 3 lines
			const snippet = extractSnippet(lines, 1, 10, 0, 3);

			expect(snippet).toBe('line 1\nline 2\nline 3');
		});

		it('should return null for empty file', () => {
			expect(extractSnippet([], 1, 1, 3, 50)).toBeNull();
		});

		it('should return null when line is beyond file length', () => {
			expect(extractSnippet(lines, 100, 100, 0, 50)).toBeNull();
		});
	});

	// =========================================================================
	// batchReadFiles
	// =========================================================================

	describe('batchReadFiles', () => {
		beforeEach(() => {
			// Default: realpath resolves to the same path (no symlinks)
			MockedFsRealpath.mockImplementation(async (p: any) => String(p));
			MockedFsStat.mockResolvedValue({ size: 1000 } as any);
			MockedFsReadFile.mockResolvedValue('line 1\nline 2\nline 3' as any);
		});

		it('should read unique files and return lines map', async () => {
			const refs = [
				{ obj: {}, filePath: 'src/a.ts', lineStart: 1, lineEnd: 1 },
				{ obj: {}, filePath: 'src/b.ts', lineStart: 2, lineEnd: 2 },
			] as any[];

			const cache = await batchReadFiles(refs, '/project');

			expect(cache.size).toBe(2);
			expect(cache.get('src/a.ts')).toEqual(['line 1', 'line 2', 'line 3']);
			expect(MockedFsReadFile).toHaveBeenCalledTimes(2);
		});

		it('should deduplicate file reads', async () => {
			const refs = [
				{ obj: {}, filePath: 'src/a.ts', lineStart: 1, lineEnd: 1 },
				{ obj: {}, filePath: 'src/a.ts', lineStart: 5, lineEnd: 5 },
				{ obj: {}, filePath: 'src/a.ts', lineStart: 10, lineEnd: 10 },
			] as any[];

			const cache = await batchReadFiles(refs, '/project');

			expect(cache.size).toBe(1);
			expect(MockedFsReadFile).toHaveBeenCalledTimes(1);
		});

		it('should skip files matching skip filters', async () => {
			const refs = [
				{
					obj: {},
					filePath: 'node_modules/lodash/index.js',
					lineStart: 1,
					lineEnd: 1,
				},
				{ obj: {}, filePath: 'dist/bundle.min.js', lineStart: 1, lineEnd: 1 },
				{ obj: {}, filePath: 'assets/logo.png', lineStart: 1, lineEnd: 1 },
			] as any[];

			const cache = await batchReadFiles(refs, '/project');

			expect(cache.size).toBe(0);
			expect(MockedFsReadFile).not.toHaveBeenCalled();
		});

		it('should silently skip missing files', async () => {
			MockedFsStat.mockRejectedValue(new Error('ENOENT'));

			const refs = [
				{ obj: {}, filePath: 'src/deleted.ts', lineStart: 1, lineEnd: 1 },
			] as any[];

			const cache = await batchReadFiles(refs, '/project');

			expect(cache.size).toBe(0);
			expect(MockedFsReadFile).not.toHaveBeenCalled();
		});

		it('should reject path traversal attempts', async () => {
			// realpath resolves the traversal to a path outside project root
			MockedFsRealpath.mockImplementation(async (p: any) => {
				const s = String(p);
				if (s === '/project') return '/project';
				// Simulate resolved traversal landing outside project root
				if (s.includes('etc/passwd')) return '/etc/passwd';
				return s;
			});

			const refs = [
				{
					obj: {},
					filePath: '../../../../etc/passwd',
					lineStart: 1,
					lineEnd: 1,
				},
			] as any[];

			const cache = await batchReadFiles(refs, '/project');

			expect(cache.size).toBe(0);
			expect(MockedFsStat).not.toHaveBeenCalled();
		});

		it('should skip files exceeding size limit', async () => {
			MockedFsStat.mockResolvedValue({ size: 2 * 1024 * 1024 } as any);

			const refs = [
				{ obj: {}, filePath: 'src/huge.ts', lineStart: 1, lineEnd: 1 },
			] as any[];

			const cache = await batchReadFiles(refs, '/project');

			expect(cache.size).toBe(0);
			expect(MockedFsReadFile).not.toHaveBeenCalled();
		});

		it('should silently skip files that throw on read', async () => {
			MockedFsReadFile.mockRejectedValue(new Error('ENOENT'));

			const refs = [
				{ obj: {}, filePath: 'src/error.ts', lineStart: 1, lineEnd: 1 },
			] as any[];

			const cache = await batchReadFiles(refs, '/project');

			expect(cache.size).toBe(0);
		});
	});

	// =========================================================================
	// injectSnippets
	// =========================================================================

	describe('injectSnippets', () => {
		it('should inject sourceSnippet into matching objects', () => {
			const obj = { filePath: 'src/a.ts', line: 2 };
			const refs = [
				{ obj, filePath: 'src/a.ts', lineStart: 2, lineEnd: 2 },
			] as any[];
			const cache = new Map([
				['src/a.ts', ['line 1', 'line 2', 'line 3', 'line 4', 'line 5']],
			]);

			injectSnippets(refs, cache, {
				contextLines: 1,
				maxLinesPerSnippet: 50,
				totalBudgetBytes: 512 * 1024,
			});

			expect(obj).toHaveProperty('sourceSnippet');
			expect((obj as any).sourceSnippet).toBe('line 1\nline 2\nline 3');
		});

		it('should stop injecting when budget is exhausted', () => {
			const obj1 = { filePath: 'src/a.ts', line: 1 };
			const obj2 = { filePath: 'src/b.ts', line: 1 };
			const refs = [
				{ obj: obj1, filePath: 'src/a.ts', lineStart: 1, lineEnd: 1 },
				{ obj: obj2, filePath: 'src/b.ts', lineStart: 1, lineEnd: 1 },
			] as any[];

			const cache = new Map([
				['src/a.ts', ['a'.repeat(100)]],
				['src/b.ts', ['b'.repeat(100)]],
			]);

			// Set budget to only allow the first snippet
			injectSnippets(refs, cache, {
				contextLines: 0,
				maxLinesPerSnippet: 50,
				totalBudgetBytes: 150,
			});

			expect(obj1).toHaveProperty('sourceSnippet');
			expect(obj2).not.toHaveProperty('sourceSnippet');
		});

		it('should skip references with no cached file', () => {
			const obj = { filePath: 'src/missing.ts', line: 1 };
			const refs = [
				{ obj, filePath: 'src/missing.ts', lineStart: 1, lineEnd: 1 },
			] as any[];
			const cache = new Map<string, string[]>();

			injectSnippets(refs, cache, {
				contextLines: 3,
				maxLinesPerSnippet: 50,
				totalBudgetBytes: 512 * 1024,
			});

			expect(obj).not.toHaveProperty('sourceSnippet');
		});

		it('should return total bytes injected', () => {
			const obj = { filePath: 'src/a.ts', line: 1 };
			const refs = [
				{ obj, filePath: 'src/a.ts', lineStart: 1, lineEnd: 1 },
			] as any[];
			const cache = new Map([['src/a.ts', ['hello world']]]);

			const totalBytes = injectSnippets(refs, cache, {
				contextLines: 0,
				maxLinesPerSnippet: 50,
				totalBudgetBytes: 512 * 1024,
			});

			expect(totalBytes).toBe(Buffer.byteLength('hello world', 'utf-8'));
		});
	});

	// =========================================================================
	// enrichWithSourceSnippets (integration)
	// =========================================================================

	describe('enrichWithSourceSnippets', () => {
		beforeEach(() => {
			MockedFsRealpath.mockImplementation(async (p: any) => String(p));
			MockedFsStat.mockResolvedValue({ size: 1000 } as any);
		});

		it('should enrich a searchSymbols-shaped response', async () => {
			MockedFsReadFile.mockResolvedValue(
				'import { foo } from "bar";\n\nexport class AuthService {\n  async login() {\n    return true;\n  }\n}\n' as any,
			);

			const data = {
				symbols: [
					{
						id: 'sym1',
						name: 'AuthService',
						filePath: 'src/auth.service.ts',
						line: 3,
						column: 0,
						kind: 'class',
						isExported: true,
					},
				],
				pagination: { total: 1, returned: 1, hasMore: false },
			};

			const result = await enrichWithSourceSnippets(data, '/project', {
				contextLines: 1,
			});

			expect(result.symbols[0]).toHaveProperty('sourceSnippet');
			const enriched = result.symbols[0] as Record<string, unknown>;
			expect(enriched.sourceSnippet).toContain('export class AuthService');
		});

		it('should enrich an impactAnalysis-shaped response', async () => {
			MockedFsReadFile.mockResolvedValue(
				'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n' as any,
			);

			const data = {
				symbol: {
					id: 'sym1',
					name: 'foo',
					qualifiedName: 'src.foo',
					kind: 'function',
					filePath: 'src/foo.ts',
					line: 5,
					column: 0,
				},
				directDependents: [
					{
						id: 'sym2',
						name: 'bar',
						qualifiedName: 'src.bar',
						kind: 'function',
						filePath: 'src/bar.ts',
						line: 3,
						relationshipType: 'CALLS',
						depth: 1,
					},
				],
			};

			const result = await enrichWithSourceSnippets(data, '/project', {
				contextLines: 1,
			});

			expect(result.symbol).toHaveProperty('sourceSnippet');
			expect(result.directDependents![0]).toHaveProperty('sourceSnippet');
		});

		it('should return data unchanged when disabled via env var', async () => {
			process.env.CONSTELLATION_INCLUDE_SNIPPETS = 'false';

			const data = {
				symbols: [{ filePath: 'src/a.ts', line: 1, name: 'a' }],
			};

			const result = await enrichWithSourceSnippets(data, '/project');

			expect(result.symbols[0]).not.toHaveProperty('sourceSnippet');
			expect(MockedFsReadFile).not.toHaveBeenCalled();
		});

		it('should return data unchanged when disabled via options', async () => {
			const data = {
				symbols: [{ filePath: 'src/a.ts', line: 1, name: 'a' }],
			};

			const result = await enrichWithSourceSnippets(data, '/project', {
				enabled: false,
			});

			expect(result.symbols[0]).not.toHaveProperty('sourceSnippet');
			expect(MockedFsReadFile).not.toHaveBeenCalled();
		});

		it('should handle case-insensitive env var values', async () => {
			process.env.CONSTELLATION_INCLUDE_SNIPPETS = 'FALSE';

			const data = { symbols: [{ filePath: 'src/a.ts', line: 1 }] };
			await enrichWithSourceSnippets(data, '/project');

			expect(MockedFsReadFile).not.toHaveBeenCalled();
		});

		it('should handle null and undefined data gracefully', async () => {
			expect(await enrichWithSourceSnippets(null, '/project')).toBeNull();
			expect(
				await enrichWithSourceSnippets(undefined, '/project'),
			).toBeUndefined();
		});

		it('should handle primitive data gracefully', async () => {
			expect(await enrichWithSourceSnippets(42, '/project')).toBe(42);
			expect(await enrichWithSourceSnippets('string', '/project')).toBe(
				'string',
			);
		});

		it('should handle data with no file references', async () => {
			const data = { message: 'pong', timestamp: '2026-01-01' };
			const result = await enrichWithSourceSnippets(data, '/project');

			expect(result).toEqual(data);
			expect(MockedFsReadFile).not.toHaveBeenCalled();
		});

		it('should options.enabled=true override env var false', async () => {
			process.env.CONSTELLATION_INCLUDE_SNIPPETS = 'false';

			MockedFsReadFile.mockResolvedValue('content\n' as any);

			const data = {
				symbols: [{ filePath: 'src/a.ts', line: 1, name: 'a' }],
			};

			const result = await enrichWithSourceSnippets(data, '/project', {
				enabled: true,
			});

			expect(result.symbols[0]).toHaveProperty('sourceSnippet');
		});
	});
});
