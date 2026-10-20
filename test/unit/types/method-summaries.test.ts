import { describe, it, expect } from '@jest/globals';
import * as wire from '@constellationdev/types';
import type { ProjectCapabilities } from '../../../src/code-mode/capabilities.js';
import {
	METHOD_SUMMARIES,
	resolveMethodName,
} from '../../../src/types/method-summaries.js';

/** The parts of a zod schema needed to reach its top-level object shape. */
interface SchemaLike {
	shape?: Record<string, unknown>;
	_def?: { schema?: SchemaLike; innerType?: SchemaLike };
}

/**
 * Top-level keys of an object schema, unwrapping refinements and optionals.
 * Takes `unknown` because the wire schemas are built with the types package's
 * own zod major, whose generics don't line up with a structural type.
 */
function schemaFields(schema: unknown): string[] {
	for (
		let s = schema as SchemaLike | undefined;
		s;
		s = s._def?.schema ?? s._def?.innerType
	) {
		if (s.shape) return Object.keys(s.shape).sort();
	}
	throw new Error('schema has no object shape');
}

/** Top-level field names of `interface <Name><suffix> { ... }` in a summary. */
function summaryFields(summary: string, suffix: 'Params' | 'Result'): string[] {
	const match = summary.match(new RegExp(`interface \\w*${suffix} \\{`));
	if (!match) return [];
	const fields: string[] = [];
	let depth = 0;
	for (const line of summary
		.slice(match.index! + match[0].length)
		.split('\n')) {
		const field = depth === 0 && line.match(/^\s*(\w+)\??\s*:/);
		if (field) fields.push(field[1]);
		depth +=
			(line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
		if (depth < 0) break;
	}
	return fields.sort();
}

/** Wire schemas each summary documents: [params, result]. */
const WIRE_CONTRACTS: Record<string, [unknown, unknown]> = {
	searchSymbols: [
		wire.searchSymbolsParamsSchema,
		wire.searchSymbolsResultSchema,
	],
	getSymbolDetails: [
		wire.getSymbolDetailsParamsSchema,
		wire.symbolDetailsResultSchema,
	],
	getDependencies: [
		wire.getDependenciesParamsSchema,
		wire.getDependenciesResultSchema,
	],
	getDependents: [
		wire.getDependentsParamsSchema,
		wire.getDependentsResultSchema,
	],
	findCircularDependencies: [
		wire.findCircularDependenciesParamsSchema,
		wire.findCircularDependenciesResultSchema,
	],
	traceSymbolUsage: [
		wire.traceSymbolUsageParamsSchema,
		wire.traceSymbolUsageResultSchema,
	],
	getCallGraph: [wire.getCallGraphParamsSchema, wire.getCallGraphResultSchema],
	impactAnalysis: [
		wire.impactAnalysisParamsSchema,
		wire.impactAnalysisResultSchema,
	],
	findOrphanedCode: [
		wire.findOrphanedCodeParamsSchema,
		wire.findOrphanedCodeResultSchema,
	],
	getArchitectureOverview: [
		wire.getArchitectureOverviewParamsSchema,
		wire.getArchitectureOverviewResultSchema,
	],
	ping: [wire.pingParamsSchema, wire.pingResultSchema],
};

// Compile-time exhaustive: a missing or extra key fails type-checking
const CAPABILITY_FIELDS: Record<keyof ProjectCapabilities, true> = {
	isIndexed: true,
	indexedBranch: true,
	lastIndexedAt: true,
	supportedLanguages: true,
	symbolCount: true,
	fileCount: true,
	availableFeatures: true,
	limitations: true,
};

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

	describe('contract with the wire types', () => {
		it('should check every summary against a contract', () => {
			expect(
				[...Object.keys(WIRE_CONTRACTS), 'getCapabilities'].sort(),
			).toEqual(Object.keys(METHOD_SUMMARIES).sort());
		});

		it.each(Object.entries(WIRE_CONTRACTS))(
			'%s summary should document exactly the wire params and result fields',
			(method, [paramsSchema, resultSchema]) => {
				const summary = METHOD_SUMMARIES[method];
				expect(summaryFields(summary, 'Params')).toEqual(
					schemaFields(paramsSchema),
				);
				expect(summaryFields(summary, 'Result')).toEqual(
					schemaFields(resultSchema),
				);
			},
		);

		it('getCapabilities summary should document exactly the ProjectCapabilities fields', () => {
			const summary = METHOD_SUMMARIES.getCapabilities;
			expect(summaryFields(summary, 'Params')).toEqual([]);
			expect(summaryFields(summary, 'Result')).toEqual(
				Object.keys(CAPABILITY_FIELDS).sort(),
			);
		});
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
