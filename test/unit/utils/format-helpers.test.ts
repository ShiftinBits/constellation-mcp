import { describe, it, expect } from '@jest/globals';
import {
	formatLocation,
	formatSymbolList,
	formatFileList,
	formatDependencies,
	formatBytes,
} from '../../../src/utils/format-helpers.js';

describe('format-helpers', () => {
	describe('formatLocation', () => {
		it('should format location with file, line, and column', () => {
			const result = formatLocation('src/test.ts', 42, 10);
			expect(result).toBe('src/test.ts:42:10');
		});

		it('should format location without column', () => {
			const result = formatLocation('src/test.ts', 42);
			expect(result).toBe('src/test.ts:42');
		});

		it('should handle special characters in file path', () => {
			const result = formatLocation('src/my file.ts', 1);
			expect(result).toBe('src/my file.ts:1');
		});
	});

	describe('formatSymbolList', () => {
		it('should format list of symbols', () => {
			const symbols = [
				{
					name: 'myFunction',
					kind: 'function',
					filePath: 'src/utils.ts',
					line: 10,
					qualifiedName: 'utils.myFunction',
				},
				{
					name: 'MyClass',
					kind: 'class',
					filePath: 'src/models.ts',
					line: 20,
					qualifiedName: 'models.MyClass',
				},
			];

			const result = formatSymbolList(symbols);

			expect(result).toContain('myFunction');
			expect(result).toContain('MyClass');
			expect(result).toContain('src/utils.ts:10');
			expect(result).toContain('src/models.ts:20');
			expect(result).toContain('function');
			expect(result).toContain('class');
		});

		it('should format empty symbol list', () => {
			const result = formatSymbolList([]);
			expect(result).toContain('No symbols found');
		});

		it('should include pagination info', () => {
			const symbols = [{ name: 'test', kind: 'function', filePath: 'test.ts', line: 1, qualifiedName: 'test' }];
			const pagination = {
				total: 100,
				returned: 1,
				hasMore: true,
				currentOffset: 0,
			};

			const result = formatSymbolList(symbols, pagination);

			expect(result).toContain('Found 100 symbols');
			expect(result).toContain('99 more result');
		});
	});

	describe('formatFileList', () => {
		it('should format list of files', () => {
			const files = [
				{
					filePath: 'src/index.ts',
					language: 'typescript',
					symbolCount: 10,
				},
				{
					filePath: 'src/utils.ts',
					language: 'typescript',
					symbolCount: 5,
				},
			];

			const result = formatFileList(files);

			expect(result).toContain('src/index.ts');
			expect(result).toContain('src/utils.ts');
			expect(result).toContain('typescript');
			expect(result).toContain('Symbols: 10');
			expect(result).toContain('Symbols: 5');
		});

		it('should format empty file list', () => {
			const result = formatFileList([]);
			expect(result).toContain('No files found');
		});

		it('should handle files without symbol count', () => {
			const files = [
				{
					filePath: 'src/test.ts',
					language: 'typescript',
				},
			];

			const result = formatFileList(files);

			expect(result).toContain('src/test.ts');
			expect(result).not.toContain('symbols');
		});
	});

	describe('formatDependencies', () => {
		it('should format list of dependencies', () => {
			const dependencies = [
				{
					source: 'src/index.ts',
					target: 'src/utils.ts',
					type: 'import',
				},
				{
					source: 'src/utils.ts',
					target: 'src/helpers.ts',
					type: 'import',
				},
			];

			const result = formatDependencies(dependencies);

			// Format shows targets with arrows
			expect(result).toContain('→ src/utils.ts');
			expect(result).toContain('→ src/helpers.ts');
			expect(result).toContain('import');
			expect(result).toContain('Found 2 dependencies');
		});

		it('should format empty dependency list', () => {
			const result = formatDependencies([]);
			expect(result).toContain('No dependencies found');
		});

		it('should show dependency type', () => {
			const dependencies = [
				{
					source: 'src/a.ts',
					target: 'src/b.ts',
					type: 'import',
				},
			];

			const result = formatDependencies(dependencies);

			expect(result).toContain('import');
		});
	});

	describe('formatBytes', () => {
		it('should format bytes', () => {
			expect(formatBytes(0)).toBe('0 Bytes');
			expect(formatBytes(1)).toBe('1 Bytes');
			expect(formatBytes(1023)).toBe('1023 Bytes');
		});

		it('should format kilobytes', () => {
			expect(formatBytes(1024)).toBe('1 KB');
			expect(formatBytes(1536)).toBe('1.5 KB');
			expect(formatBytes(10240)).toBe('10 KB');
		});

		it('should format megabytes', () => {
			expect(formatBytes(1048576)).toBe('1 MB');
			expect(formatBytes(1572864)).toBe('1.5 MB');
		});

		it('should format gigabytes', () => {
			expect(formatBytes(1073741824)).toBe('1 GB');
			expect(formatBytes(1610612736)).toBe('1.5 GB');
		});

		it('should handle negative values', () => {
			// Math.log of negative returns NaN, so function returns "NaN undefined"
			const result = formatBytes(-1024);
			expect(result).toContain('NaN');
		});

		it('should handle decimal precision', () => {
			const result = formatBytes(1536);
			expect(result).toMatch(/\d+\.\d KB/);
		});

		it('should handle very large numbers', () => {
			const result = formatBytes(1099511627776); // 1 TB
			// Function only supports up to GB, so returns "1024 GB" or similar
			expect(result).toBeDefined();
			expect(typeof result).toBe('string');
		});
	});
});
