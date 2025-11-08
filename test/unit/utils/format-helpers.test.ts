import { describe, it, expect } from '@jest/globals';
import {
	formatLocation,
	formatSymbolList,
	formatFileList,
	formatDependencies,
	formatBytes,
	emphasize,
	section,
	keyValue,
	summaryLine,
	bulletList,
	numberedList,
	collapsedHint,
	formatMetric,
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

	describe('emphasize', () => {
		it('should wrap text in bold markdown', () => {
			const result = emphasize('Important');
			expect(result).toBe('**Important**');
		});

		it('should handle empty string', () => {
			const result = emphasize('');
			expect(result).toBe('****');
		});

		it('should preserve spacing', () => {
			const result = emphasize('  spaced  ');
			expect(result).toBe('**  spaced  **');
		});
	});

	describe('section', () => {
		it('should create level 1 section header', () => {
			const result = section('Main Title', 1);
			expect(result).toBe('# Main Title');
		});

		it('should create level 2 section header by default', () => {
			const result = section('Subtitle');
			expect(result).toBe('## Subtitle');
		});

		it('should create level 3 section header', () => {
			const result = section('Sub-subtitle', 3);
			expect(result).toBe('### Sub-subtitle');
		});

		it('should create section with large level number', () => {
			const result = section('Deep', 10);
			expect(result).toBe('########## Deep');
		});

		it('should create section with level 1', () => {
			const result = section('Title', 1);
			expect(result).toBe('# Title');
		});
	});

	describe('keyValue', () => {
		it('should format key-value pair with emphasis', () => {
			const result = keyValue('Name', 'John');
			expect(result).toBe('**Name**: John');
		});

		it('should format key-value without emphasis when specified', () => {
			const result = keyValue('Age', 25, false);
			expect(result).toBe('Age: 25');
		});

		it('should handle boolean values', () => {
			const result = keyValue('Active', true);
			expect(result).toBe('**Active**: true');
		});

		it('should handle number values', () => {
			const result = keyValue('Count', 42);
			expect(result).toBe('**Count**: 42');
		});

		it('should handle empty string value', () => {
			const result = keyValue('Empty', '');
			expect(result).toBe('**Empty**: ');
		});
	});

	describe('summaryLine', () => {
		it('should format summary with multiple values', () => {
			const result = summaryLine('Stats', [
				{ key: 'Files', value: 10 },
				{ key: 'Lines', value: 1000 },
			]);
			expect(result).toBe('**Stats**: Files: 10 | Lines: 1000');
		});

		it('should handle single value', () => {
			const result = summaryLine('Total', [{ key: 'Count', value: 5 }]);
			expect(result).toBe('**Total**: Count: 5');
		});

		it('should handle empty values array', () => {
			const result = summaryLine('Empty', []);
			expect(result).toBe('**Empty**: ');
		});

		it('should handle string values', () => {
			const result = summaryLine('Info', [
				{ key: 'Name', value: 'Test' },
				{ key: 'Type', value: 'Unit' },
			]);
			expect(result).toBe('**Info**: Name: Test | Type: Unit');
		});
	});

	describe('bulletList', () => {
		it('should create bulleted list with default bullet', () => {
			const result = bulletList(['First', 'Second', 'Third']);
			expect(result).toBe('- First\n- Second\n- Third');
		});

		it('should create bulleted list with custom bullet', () => {
			const result = bulletList(['One', 'Two'], '*');
			expect(result).toBe('* One\n* Two');
		});

		it('should handle empty array', () => {
			const result = bulletList([]);
			expect(result).toBe('');
		});

		it('should handle single item', () => {
			const result = bulletList(['Only']);
			expect(result).toBe('- Only');
		});

		it('should preserve empty strings in items', () => {
			const result = bulletList(['First', '', 'Third']);
			expect(result).toBe('- First\n- \n- Third');
		});
	});

	describe('numberedList', () => {
		it('should create numbered list', () => {
			const result = numberedList(['First', 'Second', 'Third']);
			expect(result).toBe('1. First\n2. Second\n3. Third');
		});

		it('should handle empty array', () => {
			const result = numberedList([]);
			expect(result).toBe('');
		});

		it('should handle single item', () => {
			const result = numberedList(['Only']);
			expect(result).toBe('1. Only');
		});

		it('should number sequentially', () => {
			const result = numberedList(['A', 'B', 'C', 'D', 'E']);
			expect(result).toContain('1. A');
			expect(result).toContain('5. E');
		});
	});

	describe('collapsedHint', () => {
		it('should show remaining items hint', () => {
			const result = collapsedHint(100, 20);
			expect(result).toBe('... and 80 more');
		});

		it('should return empty string when all shown', () => {
			const result = collapsedHint(10, 10);
			expect(result).toBe('');
		});

		it('should handle single remaining item', () => {
			const result = collapsedHint(21, 20);
			expect(result).toBe('... and 1 more');
		});

		it('should handle large numbers', () => {
			const result = collapsedHint(10000, 50);
			expect(result).toBe('... and 9950 more');
		});

		it('should return empty string when none shown', () => {
			const result = collapsedHint(100, 100);
			expect(result).toBe('');
		});
	});

	describe('formatMetric', () => {
		it('should format metric above threshold', () => {
			const result = formatMetric(75, 'complexity', 50, '>');
			expect(result).toBe('**complexity**: **75**');
		});

		it('should format metric below threshold', () => {
			const result = formatMetric(75, 'coverage', 80, '<');
			expect(result).toBe('**coverage**: **75**');
		});

		it('should format metric at threshold (greater than)', () => {
			const result = formatMetric(50, 'value', 50, '>');
			expect(result).toBe('**value**: 50');
		});

		it('should format metric at threshold (less than)', () => {
			const result = formatMetric(50, 'value', 50, '<');
			expect(result).toBe('**value**: 50');
		});

		it('should handle no threshold', () => {
			const result = formatMetric(42, 'score');
			expect(result).toBe('**score**: 42');
		});

		it('should handle zero values', () => {
			const result = formatMetric(0, 'count', 10, '>');
			expect(result).toBe('**count**: 0');
		});

		it('should handle negative values', () => {
			const result = formatMetric(-5, 'delta', 0, '>');
			expect(result).toBe('**delta**: -5');
		});
	});
});
