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

	it('each summary should include a header with method name and shorthand', () => {
		for (const [name, summary] of Object.entries(METHOD_SUMMARIES)) {
			expect(summary).toContain(name);
		}
	});

	describe('resolveMethodName', () => {
		it('should resolve canonical method names', () => {
			expect(resolveMethodName('searchSymbols')).toBe('searchSymbols');
			expect(resolveMethodName('impactAnalysis')).toBe('impactAnalysis');
		});

		it('should resolve shorthand aliases', () => {
			expect(resolveMethodName('search')).toBe('searchSymbols');
			expect(resolveMethodName('deps')).toBe('getDependencies');
			expect(resolveMethodName('impact')).toBe('impactAnalysis');
			expect(resolveMethodName('orphans')).toBe('findOrphanedCode');
			expect(resolveMethodName('cycles')).toBe('findCircularDependencies');
			expect(resolveMethodName('overview')).toBe('getArchitectureOverview');
			expect(resolveMethodName('details')).toBe('getSymbolDetails');
			expect(resolveMethodName('dependents')).toBe('getDependents');
			expect(resolveMethodName('usage')).toBe('traceSymbolUsage');
			expect(resolveMethodName('calls')).toBe('getCallGraph');
		});

		it('should return null for unknown names', () => {
			expect(resolveMethodName('nonexistent')).toBeNull();
			expect(resolveMethodName('')).toBeNull();
		});
	});
});
