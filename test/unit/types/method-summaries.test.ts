import { describe, it, expect } from '@jest/globals';
import {
	METHOD_SUMMARIES,
	resolveMethodName,
} from '../../../src/types/method-summaries.js';

describe('method-summaries', () => {
	const CANONICAL_METHODS = [
		'searchSymbols',
		'getSymbolDetails',
		'getDependencies',
		'getDependents',
		'findCircularDependencies',
		'traceSymbolUsage',
		'getCallGraph',
		'impactAnalysis',
		'findOrphanedCode',
		'getArchitectureOverview',
		'ping',
		'getCapabilities',
	];

	it('should have summaries for all 12 API methods', () => {
		for (const method of CANONICAL_METHODS) {
			expect(METHOD_SUMMARIES).toHaveProperty(method);
			expect(typeof METHOD_SUMMARIES[method]).toBe('string');
			expect(METHOD_SUMMARIES[method].length).toBeGreaterThan(50);
		}
	});

	it('should not have extra keys beyond the 12 methods', () => {
		expect(Object.keys(METHOD_SUMMARIES)).toHaveLength(12);
	});

	it('each summary should include Params and Result interfaces', () => {
		for (const method of CANONICAL_METHODS) {
			const summary = METHOD_SUMMARIES[method];
			// ping and getCapabilities may not have separate Params
			if (method !== 'ping') {
				expect(summary).toMatch(/interface \w+Params/);
			}
			expect(summary).toMatch(/interface \w+Result|-> \{/);
		}
	});

	it('each summary should include a header with method name', () => {
		for (const [name, summary] of Object.entries(METHOD_SUMMARIES)) {
			expect(summary).toContain(name);
		}
	});

	describe('getCallGraph summary', () => {
		const summary = METHOD_SUMMARIES.getCallGraph;

		it('should use the canonical direction enum (incoming | outgoing | both)', () => {
			// Whitespace-tolerant regex so the assertion does not break when
			// the surrounding interface comment is reflowed.
			expect(summary).toMatch(
				/direction\?:\s*'incoming'\s*\|\s*'outgoing'\s*\|\s*'both'/,
			);
		});

		it('should not document deprecated direction values in the canonical type', () => {
			expect(summary).not.toMatch(
				/direction\?:\s*'callers'\s*\|\s*'callees'\s*\|\s*'both'/,
			);
		});

		it('should still document response keys callers and callees (response shape unchanged)', () => {
			expect(summary).toContain('callers?:');
			expect(summary).toContain('callees?:');
		});

		it('should mention deprecation of legacy aliases for discoverability', () => {
			expect(summary.toLowerCase()).toContain('deprecated');
			expect(summary).toContain('callers');
			expect(summary).toContain('callees');
		});
	});

	it('searchSymbols summary should document the limit default and max', () => {
		const summary = METHOD_SUMMARIES.searchSymbols;
		expect(summary).toContain('default 50, max 100');
	});

	it('getSymbolDetails summary should document the enriched SymbolDetail fields', () => {
		const summary = METHOD_SUMMARIES.getSymbolDetails;
		expect(summary).toContain('documentation');
		expect(summary).toContain('typeInfo');
		expect(summary).toContain('members');
		expect(summary).toContain('parent');
		expect(summary).toContain('decorators');
		expect(summary).toContain('OMITTED');
		expect(summary).toContain('TypeScript-only for now');
	});

	it('findOrphanedCode summary should document pagination and summary fields', () => {
		const summary = METHOD_SUMMARIES.findOrphanedCode;
		expect(summary).toContain('pagination?');
		expect(summary).toContain('summary?');
		expect(summary).toContain('totalOrphanedSymbols');
		expect(summary).toContain('totalOrphanedFiles');
		expect(summary).toContain('hasMore');
		expect(summary).toContain('resultContext');
	});

	describe('resolveMethodName', () => {
		it('should resolve canonical method names', () => {
			expect(resolveMethodName('searchSymbols')).toBe('searchSymbols');
			expect(resolveMethodName('impactAnalysis')).toBe('impactAnalysis');
		});

		it('should return null for unknown names', () => {
			expect(resolveMethodName('nonexistent')).toBeNull();
			expect(resolveMethodName('')).toBeNull();
		});
	});
});
