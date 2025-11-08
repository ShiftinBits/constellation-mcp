import { describe, it, expect } from '@jest/globals';
import {
	MARKERS,
	getSymbolMarkers,
	getFileMarkers,
	applyMarkers,
	markExported,
	markDeprecated,
	markAbstract,
} from '../../../src/utils/semantic-markers.js';

describe('semantic-markers', () => {
	describe('MARKERS constants', () => {
		it('should define all marker constants', () => {
			expect(MARKERS.EXPORTED).toBe('[EXPORTED]');
			expect(MARKERS.ABSTRACT).toBe('[ABSTRACT]');
			expect(MARKERS.DEPRECATED).toBe('[DEPRECATED]');
			expect(MARKERS.HIGH_IMPACT).toBe('[HIGH_IMPACT]');
			expect(MARKERS.BREAKING).toBe('[BREAKING]');
			expect(MARKERS.SAFE).toBe('[SAFE]');
			expect(MARKERS.RISKY).toBe('[RISKY]');
			expect(MARKERS.TEST).toBe('[TEST]');
			expect(MARKERS.CONFIG).toBe('[CONFIG]');
			expect(MARKERS.GENERATED).toBe('[GENERATED]');
			expect(MARKERS.INTERNAL).toBe('[INTERNAL]');
			expect(MARKERS.EXTERNAL).toBe('[EXTERNAL]');
			expect(MARKERS.UNUSED).toBe('[UNUSED]');
			expect(MARKERS.HEAVILY_USED).toBe('[HEAVILY_USED]');
			expect(MARKERS.CIRCULAR).toBe('[CIRCULAR]');
			expect(MARKERS.HIGH_COMPLEXITY).toBe('[HIGH_COMPLEXITY]');
			expect(MARKERS.LOW_COVERAGE).toBe('[LOW_COVERAGE]');
		});
	});

	describe('getSymbolMarkers', () => {
		it('should return empty array for default symbol', () => {
			const markers = getSymbolMarkers({});
			expect(markers).toEqual([]);
		});

		it('should return EXPORTED marker for exported symbol', () => {
			const markers = getSymbolMarkers({ isExported: true });
			expect(markers).toContain(MARKERS.EXPORTED);
		});

		it('should return ABSTRACT marker for abstract symbol', () => {
			const markers = getSymbolMarkers({ isAbstract: true });
			expect(markers).toContain(MARKERS.ABSTRACT);
		});

		it('should return DEPRECATED marker for deprecated symbol', () => {
			const markers = getSymbolMarkers({ isDeprecated: true });
			expect(markers).toContain(MARKERS.DEPRECATED);
		});

		it('should return HEAVILY_USED marker for symbol with high usage count', () => {
			const markers = getSymbolMarkers({ usageCount: 100 });
			expect(markers).toContain(MARKERS.HEAVILY_USED);
		});

		it('should return HEAVILY_USED marker for symbol with 20+ usages', () => {
			const markers = getSymbolMarkers({ usageCount: 25 });
			expect(markers).toContain(MARKERS.HEAVILY_USED);
		});

		it('should return UNUSED marker for symbol with 0 usages', () => {
			const markers = getSymbolMarkers({ usageCount: 0 });
			expect(markers).toContain(MARKERS.UNUSED);
		});

		it('should return INTERNAL marker for non-exported symbol', () => {
			const markers = getSymbolMarkers({ isExported: false });
			expect(markers).toContain(MARKERS.INTERNAL);
		});

		it('should combine multiple markers', () => {
			const markers = getSymbolMarkers({
				isExported: true,
				isDeprecated: true,
				usageCount: 100,
			});
			expect(markers).toContain(MARKERS.EXPORTED);
			expect(markers).toContain(MARKERS.DEPRECATED);
			expect(markers).toContain(MARKERS.HEAVILY_USED);
			expect(markers.length).toBe(3);
		});

		it('should return EXTERNAL marker for external symbols', () => {
			const markers = getSymbolMarkers({ isExternal: true });
			expect(markers).toContain(MARKERS.EXTERNAL);
		});
	});

	describe('getFileMarkers', () => {
		it('should return empty array for regular file', () => {
			const markers = getFileMarkers('src/components/Button.tsx');
			expect(markers).toEqual([]);
		});

		it('should return TEST marker for test files', () => {
			expect(getFileMarkers('src/Button.test.ts')).toContain(MARKERS.TEST);
			expect(getFileMarkers('src/Button.spec.ts')).toContain(MARKERS.TEST);
			expect(getFileMarkers('src/test/Button.ts')).toContain(MARKERS.TEST);
			expect(getFileMarkers('src/__tests__/Button.ts')).toContain(MARKERS.TEST);
		});

		it('should return CONFIG marker for config files', () => {
			expect(getFileMarkers('app.config.ts')).toContain(MARKERS.CONFIG);
			expect(getFileMarkers('tsconfig.json')).toContain(MARKERS.CONFIG);
			expect(getFileMarkers('package.json')).toContain(MARKERS.CONFIG);
			expect(getFileMarkers('config.yml')).toContain(MARKERS.CONFIG);
			expect(getFileMarkers('settings.yaml')).toContain(MARKERS.CONFIG);
		});

		it('should return GENERATED marker for generated files', () => {
			expect(getFileMarkers('src/types.generated.ts')).toContain(MARKERS.GENERATED);
			expect(getFileMarkers('src/generated/types.ts')).toContain(MARKERS.GENERATED);
			expect(getFileMarkers('schema.g.ts')).toContain(MARKERS.GENERATED);
		});

		it('should return EXTERNAL marker for vendor files', () => {
			expect(getFileMarkers('node_modules/package/index.js')).toContain(MARKERS.EXTERNAL);
			expect(getFileMarkers('vendor/lib/helper.js')).toContain(MARKERS.EXTERNAL);
		});

		it('should handle empty file path', () => {
			expect(getFileMarkers('')).toEqual([]);
		});

		it('should handle file paths with mixed case', () => {
			expect(getFileMarkers('src/Button.TEST.ts')).toContain(MARKERS.TEST);
			expect(getFileMarkers('SRC/BUTTON.SPEC.TS')).toContain(MARKERS.TEST);
		});
	});

	describe('applyMarkers', () => {
		it('should apply markers before text', () => {
			const result = applyMarkers([MARKERS.EXPORTED], 'myFunction');
			expect(result).toBe('[EXPORTED] myFunction');
		});

		it('should apply multiple markers', () => {
			const result = applyMarkers(
				[MARKERS.EXPORTED, MARKERS.DEPRECATED],
				'myFunction'
			);
			expect(result).toBe('[EXPORTED] [DEPRECATED] myFunction');
		});

		it('should return text unchanged when no markers', () => {
			const result = applyMarkers([], 'myFunction');
			expect(result).toBe('myFunction');
		});

		it('should handle empty text', () => {
			const result = applyMarkers([MARKERS.EXPORTED], '');
			expect(result).toBe('[EXPORTED] ');
		});

		it('should preserve text spacing', () => {
			const result = applyMarkers([MARKERS.TEST], '  myFunction  ');
			expect(result).toBe('[TEST]   myFunction  ');
		});
	});

	describe('markExported', () => {
		it('should add EXPORTED marker', () => {
			const result = markExported('myFunction');
			expect(result).toBe('[EXPORTED] myFunction');
		});

		it('should handle empty string', () => {
			const result = markExported('');
			expect(result).toBe('[EXPORTED] ');
		});
	});

	describe('markDeprecated', () => {
		it('should add DEPRECATED marker', () => {
			const result = markDeprecated('oldFunction');
			expect(result).toBe('[DEPRECATED] oldFunction');
		});

		it('should handle empty string', () => {
			const result = markDeprecated('');
			expect(result).toBe('[DEPRECATED] ');
		});
	});

	describe('markAbstract', () => {
		it('should add ABSTRACT marker', () => {
			const result = markAbstract('BaseClass');
			expect(result).toBe('[ABSTRACT] BaseClass');
		});

		it('should handle empty string', () => {
			const result = markAbstract('');
			expect(result).toBe('[ABSTRACT] ');
		});
	});

	describe('integration scenarios', () => {
		it('should handle exported deprecated symbol with high usage', () => {
			const markers = getSymbolMarkers({
				isExported: true,
				isDeprecated: true,
				usageCount: 150,
			});
			const result = applyMarkers(markers, 'legacyFunction');

			expect(result).toContain(MARKERS.EXPORTED);
			expect(result).toContain(MARKERS.DEPRECATED);
			expect(result).toContain(MARKERS.HEAVILY_USED);
			expect(result).toContain('legacyFunction');
		});

		it('should handle test file with specific naming', () => {
			const filePath = 'src/components/__tests__/Button.test.tsx';
			const markers = getFileMarkers(filePath);

			expect(markers).toContain(MARKERS.TEST);
			expect(markers.length).toBe(1); // Only TEST marker should be present
		});

		it('should handle config file in root directory', () => {
			const filePath = '.prettierrc.json';
			const markers = getFileMarkers(filePath);

			expect(markers).toContain(MARKERS.CONFIG);
		});

		it('should handle generated file in generated directory', () => {
			const filePath = 'src/generated/api-types.ts';
			const markers = getFileMarkers(filePath);

			expect(markers).toContain(MARKERS.GENERATED);
		});

		it('should format symbol with all metadata', () => {
			const markers = getSymbolMarkers({
				isExported: true,
				isAbstract: true,
				isDeprecated: true,
			});
			const result = applyMarkers(markers, 'AbstractBaseClass');

			expect(result).toBe('[DEPRECATED] [ABSTRACT] [EXPORTED] AbstractBaseClass');
		});

		it('should handle edge case: internal unused symbol', () => {
			const markers = getSymbolMarkers({
				isExported: false,
				usageCount: 0,
			});

			expect(markers).toContain(MARKERS.INTERNAL);
			expect(markers).toContain(MARKERS.UNUSED);
		});
	});
});
