/**
 * Dangerous Patterns Unit Tests
 */

import { describe, it, expect } from '@jest/globals';
import { parse } from 'acorn';
import type { Node } from 'acorn';
import { walk } from '../../../../src/code-mode/validators/ast-walker.js';
import {
	DANGEROUS_PATTERNS,
	DANGEROUS_PROPERTIES,
	DANGEROUS_GLOBALS,
	checkAllPatterns,
	type PatternMatch,
} from '../../../../src/code-mode/validators/dangerous-patterns.js';

const parseCode = (code: string): Node =>
	parse(code, { ecmaVersion: 'latest', allowAwaitOutsideFunction: true });

function findPatternMatches(code: string): PatternMatch[] {
	const ast = parseCode(code);
	const matches: PatternMatch[] = [];

	walk(ast, {
		enter(node, parent) {
			matches.push(...checkAllPatterns(node, parent));
		},
	});

	return matches;
}

describe('dangerous-patterns', () => {
	describe('DANGEROUS_PROPERTIES', () => {
		it('should contain constructor', () => {
			expect(DANGEROUS_PROPERTIES.has('constructor')).toBe(true);
		});

		it('should contain __proto__', () => {
			expect(DANGEROUS_PROPERTIES.has('__proto__')).toBe(true);
		});

		it('should contain prototype', () => {
			expect(DANGEROUS_PROPERTIES.has('prototype')).toBe(true);
		});

		it('should contain legacy getters/setters', () => {
			expect(DANGEROUS_PROPERTIES.has('__defineGetter__')).toBe(true);
			expect(DANGEROUS_PROPERTIES.has('__defineSetter__')).toBe(true);
			expect(DANGEROUS_PROPERTIES.has('__lookupGetter__')).toBe(true);
			expect(DANGEROUS_PROPERTIES.has('__lookupSetter__')).toBe(true);
		});
	});

	describe('DANGEROUS_GLOBALS', () => {
		it('should contain process', () => {
			expect(DANGEROUS_GLOBALS.has('process')).toBe(true);
		});

		it('should contain global and globalThis', () => {
			expect(DANGEROUS_GLOBALS.has('global')).toBe(true);
			expect(DANGEROUS_GLOBALS.has('globalThis')).toBe(true);
		});

		it('should contain require/module/exports', () => {
			expect(DANGEROUS_GLOBALS.has('require')).toBe(true);
			expect(DANGEROUS_GLOBALS.has('module')).toBe(true);
			expect(DANGEROUS_GLOBALS.has('exports')).toBe(true);
		});

		it('should contain eval and Function', () => {
			expect(DANGEROUS_GLOBALS.has('eval')).toBe(true);
			expect(DANGEROUS_GLOBALS.has('Function')).toBe(true);
		});

		it('should contain Proxy and Reflect', () => {
			expect(DANGEROUS_GLOBALS.has('Proxy')).toBe(true);
			expect(DANGEROUS_GLOBALS.has('Reflect')).toBe(true);
		});

		it('should contain Buffer', () => {
			expect(DANGEROUS_GLOBALS.has('Buffer')).toBe(true);
		});

		it('should contain __dirname and __filename', () => {
			expect(DANGEROUS_GLOBALS.has('__dirname')).toBe(true);
			expect(DANGEROUS_GLOBALS.has('__filename')).toBe(true);
		});
	});

	describe('constructor-access pattern', () => {
		it('should detect obj.constructor', () => {
			const matches = findPatternMatches('obj.constructor');
			expect(matches.some((m) => m.pattern === 'constructor-access')).toBe(
				true,
			);
		});

		it('should detect [].constructor', () => {
			const matches = findPatternMatches('[].constructor');
			expect(matches.some((m) => m.pattern === 'constructor-access')).toBe(
				true,
			);
		});

		it('should detect chained constructor access', () => {
			const matches = findPatternMatches('[].constructor.constructor');
			const constructorMatches = matches.filter(
				(m) => m.pattern === 'constructor-access',
			);
			expect(constructorMatches.length).toBe(2);
		});

		it('should detect obj["constructor"] via computed-dangerous-property', () => {
			const matches = findPatternMatches('obj["constructor"]');
			expect(
				matches.some((m) => m.pattern === 'computed-dangerous-property'),
			).toBe(true);
		});
	});

	describe('proto-access pattern', () => {
		it('should detect obj.__proto__', () => {
			const matches = findPatternMatches('obj.__proto__');
			expect(matches.some((m) => m.pattern === 'proto-access')).toBe(true);
		});

		it('should detect [].__proto__', () => {
			const matches = findPatternMatches('[].__proto__');
			expect(matches.some((m) => m.pattern === 'proto-access')).toBe(true);
		});

		it('should detect obj["__proto__"] via computed-dangerous-property', () => {
			const matches = findPatternMatches('obj["__proto__"]');
			expect(
				matches.some((m) => m.pattern === 'computed-dangerous-property'),
			).toBe(true);
		});
	});

	describe('prototype-access pattern', () => {
		it('should detect Object.prototype', () => {
			const matches = findPatternMatches('Object.prototype');
			expect(matches.some((m) => m.pattern === 'prototype-access')).toBe(true);
		});

		it('should detect Array.prototype', () => {
			const matches = findPatternMatches('Array.prototype');
			expect(matches.some((m) => m.pattern === 'prototype-access')).toBe(true);
		});

		it('should detect obj["prototype"] via computed-dangerous-property', () => {
			const matches = findPatternMatches('obj["prototype"]');
			expect(
				matches.some((m) => m.pattern === 'computed-dangerous-property'),
			).toBe(true);
		});
	});

	describe('dangerous-global pattern', () => {
		it('should detect process', () => {
			const matches = findPatternMatches('process');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(true);
		});

		it('should detect globalThis', () => {
			const matches = findPatternMatches('globalThis');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(true);
		});

		it('should detect require', () => {
			const matches = findPatternMatches('require');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(true);
		});

		it('should detect eval', () => {
			const matches = findPatternMatches('eval');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(true);
		});

		it('should detect Function', () => {
			const matches = findPatternMatches('Function');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(true);
		});

		it('should detect Proxy', () => {
			const matches = findPatternMatches('Proxy');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(true);
		});

		it('should detect Reflect', () => {
			const matches = findPatternMatches('Reflect');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(true);
		});

		it('should NOT detect "process" as property key in object literal', () => {
			const matches = findPatternMatches('({ process: 1 })');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(false);
		});

		it('should NOT detect "require" as property access', () => {
			const matches = findPatternMatches('obj.require');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(false);
		});

		it('should NOT detect "global" as method name', () => {
			const matches = findPatternMatches('obj.global()');
			expect(matches.some((m) => m.pattern === 'dangerous-global')).toBe(false);
		});
	});

	describe('dynamic-import pattern', () => {
		it('should detect import()', () => {
			const matches = findPatternMatches('import("module")');
			expect(matches.some((m) => m.pattern === 'dynamic-import')).toBe(true);
		});

		it('should detect import() with variable', () => {
			const matches = findPatternMatches('import(moduleName)');
			expect(matches.some((m) => m.pattern === 'dynamic-import')).toBe(true);
		});
	});

	describe('with-statement pattern', () => {
		it('should detect with statement', () => {
			const matches = findPatternMatches('with (obj) { x }');
			expect(matches.some((m) => m.pattern === 'with-statement')).toBe(true);
		});
	});

	describe('computed-dangerous-property pattern', () => {
		it('should detect obj["constructor"]', () => {
			const matches = findPatternMatches('obj["constructor"]');
			expect(
				matches.some((m) => m.pattern === 'computed-dangerous-property'),
			).toBe(true);
		});

		it('should detect obj["__proto__"]', () => {
			const matches = findPatternMatches('obj["__proto__"]');
			expect(
				matches.some((m) => m.pattern === 'computed-dangerous-property'),
			).toBe(true);
		});

		it('should detect obj["prototype"]', () => {
			const matches = findPatternMatches('obj["prototype"]');
			expect(
				matches.some((m) => m.pattern === 'computed-dangerous-property'),
			).toBe(true);
		});

		it('should detect nested computed access', () => {
			const matches = findPatternMatches('obj["constructor"]["constructor"]');
			const computedMatches = matches.filter(
				(m) => m.pattern === 'computed-dangerous-property',
			);
			expect(computedMatches.length).toBe(2);
		});

		it('should NOT detect obj[variable] (dynamic, unknown)', () => {
			const matches = findPatternMatches('obj[variable]');
			expect(
				matches.some((m) => m.pattern === 'computed-dangerous-property'),
			).toBe(false);
		});

		it('should NOT detect obj[123] (numeric)', () => {
			const matches = findPatternMatches('obj[123]');
			expect(
				matches.some((m) => m.pattern === 'computed-dangerous-property'),
			).toBe(false);
		});
	});

	describe('legacy-property-access pattern', () => {
		it('should detect obj.__defineGetter__', () => {
			const matches = findPatternMatches('obj.__defineGetter__');
			expect(matches.some((m) => m.pattern === 'legacy-property-access')).toBe(
				true,
			);
		});

		it('should detect obj.__defineSetter__', () => {
			const matches = findPatternMatches('obj.__defineSetter__');
			expect(matches.some((m) => m.pattern === 'legacy-property-access')).toBe(
				true,
			);
		});

		it('should detect obj.__lookupGetter__', () => {
			const matches = findPatternMatches('obj.__lookupGetter__');
			expect(matches.some((m) => m.pattern === 'legacy-property-access')).toBe(
				true,
			);
		});

		it('should detect obj.__lookupSetter__', () => {
			const matches = findPatternMatches('obj.__lookupSetter__');
			expect(matches.some((m) => m.pattern === 'legacy-property-access')).toBe(
				true,
			);
		});
	});

	describe('legitimate code (should NOT match)', () => {
		it('should allow api.searchSymbols()', () => {
			const matches = findPatternMatches(
				'api.searchSymbols({ query: "test" })',
			);
			expect(matches.length).toBe(0);
		});

		it('should allow array methods', () => {
			const matches = findPatternMatches('[1, 2, 3].map(x => x * 2)');
			expect(matches.length).toBe(0);
		});

		it('should allow object literals with "constructor" as key', () => {
			const matches = findPatternMatches('({ constructor: "value" })');
			expect(matches.length).toBe(0);
		});

		it('should allow Promise.all', () => {
			const matches = findPatternMatches('Promise.all([a, b])');
			expect(matches.length).toBe(0);
		});

		it('should allow JSON.stringify', () => {
			const matches = findPatternMatches('JSON.stringify(obj)');
			expect(matches.length).toBe(0);
		});

		it('should allow Math.max', () => {
			const matches = findPatternMatches('Math.max(1, 2, 3)');
			expect(matches.length).toBe(0);
		});

		it('should allow new Date()', () => {
			const matches = findPatternMatches('new Date()');
			expect(matches.length).toBe(0);
		});

		it('should allow new Map()', () => {
			const matches = findPatternMatches('new Map()');
			expect(matches.length).toBe(0);
		});

		it('should allow new Set()', () => {
			const matches = findPatternMatches('new Set()');
			expect(matches.length).toBe(0);
		});

		it('should allow Array.isArray', () => {
			const matches = findPatternMatches('Array.isArray(x)');
			expect(matches.length).toBe(0);
		});

		it('should allow String.fromCharCode', () => {
			const matches = findPatternMatches('String.fromCharCode(65)');
			expect(matches.length).toBe(0);
		});

		it('should allow Object.keys', () => {
			const matches = findPatternMatches('Object.keys(obj)');
			expect(matches.length).toBe(0);
		});

		it('should allow console.log', () => {
			const matches = findPatternMatches('console.log("hello")');
			expect(matches.length).toBe(0);
		});

		it('should allow await with api calls', () => {
			const matches = findPatternMatches(
				'await api.getDependencies({ filePath: "test.ts" })',
			);
			expect(matches.length).toBe(0);
		});
	});

	describe('checkAllPatterns', () => {
		it('should return multiple matches for chained dangerous access', () => {
			const matches = findPatternMatches(
				'[].constructor.constructor("return this")()',
			);
			expect(matches.length).toBeGreaterThanOrEqual(2);
		});

		it('should return empty array for safe code', () => {
			const matches = findPatternMatches('const x = 1 + 2');
			expect(matches).toEqual([]);
		});
	});

	describe('computed-dynamic-property pattern (SB-258)', () => {
		it('should match obj[variable] with dynamic computed access', () => {
			const matches = findPatternMatches('const x = obj[variable]');
			expect(
				matches.some((m) => m.pattern === 'computed-dynamic-property'),
			).toBe(true);
		});

		it('should not match arr[0] (numeric literal)', () => {
			const matches = findPatternMatches('const x = arr[0]');
			expect(
				matches.some((m) => m.pattern === 'computed-dynamic-property'),
			).toBe(false);
		});

		it('should not match obj["key"] (string literal — handled by computed-dangerous-property)', () => {
			const matches = findPatternMatches('const x = obj["safe"]');
			expect(
				matches.some((m) => m.pattern === 'computed-dynamic-property'),
			).toBe(false);
		});

		it('should match obj[fn()] with computed call expression', () => {
			const matches = findPatternMatches('const x = obj[fn()]');
			expect(
				matches.some((m) => m.pattern === 'computed-dynamic-property'),
			).toBe(true);
		});

		it('should not match dot notation access', () => {
			const matches = findPatternMatches('const x = obj.prop');
			expect(
				matches.some((m) => m.pattern === 'computed-dynamic-property'),
			).toBe(false);
		});
	});

	describe('DANGEROUS_PATTERNS array', () => {
		it('should have 9 pattern checkers', () => {
			expect(DANGEROUS_PATTERNS.length).toBe(9);
		});

		it('should have unique pattern IDs', () => {
			const ids = DANGEROUS_PATTERNS.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it('should have descriptions for all patterns', () => {
			for (const pattern of DANGEROUS_PATTERNS) {
				expect(pattern.description).toBeTruthy();
			}
		});
	});
});
