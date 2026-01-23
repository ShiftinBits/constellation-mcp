/**
 * AST Validator Unit Tests
 */

import { describe, it, expect } from '@jest/globals';
import {
	validateAst,
	offsetToLocation,
} from '../../../../src/code-mode/validators/ast-validator.js';

describe('ast-validator', () => {
	describe('offsetToLocation', () => {
		it('should return line 1 column 0 for offset 0', () => {
			const location = offsetToLocation('hello', 0);
			expect(location).toEqual({ line: 1, column: 0 });
		});

		it('should calculate column correctly on first line', () => {
			const location = offsetToLocation('hello world', 6);
			expect(location).toEqual({ line: 1, column: 6 });
		});

		it('should calculate line correctly after newlines', () => {
			const code = 'line1\nline2\nline3';
			const location = offsetToLocation(code, 6);
			expect(location).toEqual({ line: 2, column: 0 });
		});

		it('should calculate column correctly on subsequent lines', () => {
			const code = 'line1\nline2\nline3';
			const location = offsetToLocation(code, 10);
			expect(location).toEqual({ line: 2, column: 4 });
		});

		it('should handle multiple newlines', () => {
			const code = 'a\nb\nc\nd';
			const location = offsetToLocation(code, 6);
			expect(location).toEqual({ line: 4, column: 0 });
		});

		it('should return null for negative offset', () => {
			const location = offsetToLocation('hello', -1);
			expect(location).toBeNull();
		});

		it('should return null for offset beyond code length', () => {
			const location = offsetToLocation('hello', 100);
			expect(location).toBeNull();
		});

		it('should handle empty string', () => {
			const location = offsetToLocation('', 0);
			expect(location).toEqual({ line: 1, column: 0 });
		});
	});

	describe('validateAst', () => {
		describe('constructor chain attacks', () => {
			it('should block [].constructor', () => {
				const result = validateAst('[].constructor');
				expect(result.valid).toBe(false);
				expect(
					result.errors.some((e) => e.pattern === 'constructor-access'),
				).toBe(true);
			});

			it('should block [].constructor.constructor', () => {
				const result = validateAst('[].constructor.constructor');
				expect(result.valid).toBe(false);
				const constructorErrors = result.errors.filter(
					(e) => e.pattern === 'constructor-access',
				);
				expect(constructorErrors.length).toBe(2);
			});

			it('should block obj["constructor"]', () => {
				const result = validateAst('obj["constructor"]');
				expect(result.valid).toBe(false);
				expect(
					result.errors.some(
						(e) => e.pattern === 'computed-dangerous-property',
					),
				).toBe(true);
			});

			it('should block complex constructor chain attack', () => {
				const result = validateAst(
					'[]["constructor"]["constructor"]("return this")()',
				);
				expect(result.valid).toBe(false);
			});
		});

		describe('prototype access', () => {
			it('should block obj.__proto__', () => {
				const result = validateAst('obj.__proto__');
				expect(result.valid).toBe(false);
				expect(result.errors.some((e) => e.pattern === 'proto-access')).toBe(
					true,
				);
			});

			it('should block [].__proto__', () => {
				const result = validateAst('[].__proto__');
				expect(result.valid).toBe(false);
			});

			it('should block Object.prototype', () => {
				const result = validateAst('Object.prototype');
				expect(result.valid).toBe(false);
				expect(
					result.errors.some((e) => e.pattern === 'prototype-access'),
				).toBe(true);
			});

			it('should block obj["__proto__"]', () => {
				const result = validateAst('obj["__proto__"]');
				expect(result.valid).toBe(false);
				expect(
					result.errors.some(
						(e) => e.pattern === 'computed-dangerous-property',
					),
				).toBe(true);
			});
		});

		describe('dangerous globals', () => {
			it('should block globalThis', () => {
				const result = validateAst('globalThis');
				expect(result.valid).toBe(false);
				expect(
					result.errors.some((e) => e.pattern === 'dangerous-global'),
				).toBe(true);
			});

			it('should block process', () => {
				const result = validateAst('process');
				expect(result.valid).toBe(false);
			});

			it('should block require', () => {
				const result = validateAst('require');
				expect(result.valid).toBe(false);
			});

			it('should block the eval identifier', () => {
				// Testing that direct reference to dangerous global is blocked
				const result = validateAst('x = eval');
				expect(result.valid).toBe(false);
			});

			it('should block Proxy', () => {
				const result = validateAst('Proxy');
				expect(result.valid).toBe(false);
			});

			it('should block Reflect', () => {
				const result = validateAst('Reflect');
				expect(result.valid).toBe(false);
			});

			it('should block Function constructor', () => {
				const result = validateAst('Function');
				expect(result.valid).toBe(false);
			});
		});

		describe('dangerous statements', () => {
			it('should block dynamic import()', () => {
				const result = validateAst('import("fs")');
				expect(result.valid).toBe(false);
				expect(result.errors.some((e) => e.pattern === 'dynamic-import')).toBe(
					true,
				);
			});

			it('should block with statement', () => {
				const result = validateAst('with (obj) { x }');
				expect(result.valid).toBe(false);
				expect(result.errors.some((e) => e.pattern === 'with-statement')).toBe(
					true,
				);
			});
		});

		describe('legitimate code that must be allowed', () => {
			it('should allow api.searchSymbols()', () => {
				const result = validateAst('api.searchSymbols({ query: "test" })');
				expect(result.valid).toBe(true);
				expect(result.errors).toEqual([]);
			});

			it('should allow await api.getDependencies()', () => {
				const result = validateAst(
					'await api.getDependencies({ filePath: "test.ts" })',
				);
				expect(result.valid).toBe(true);
			});

			it('should allow return statement', () => {
				const result = validateAst(
					'return await api.searchSymbols({ query: "test" })',
				);
				expect(result.valid).toBe(true);
			});

			it('should allow array methods', () => {
				const result = validateAst('[1, 2, 3].map(x => x * 2)');
				expect(result.valid).toBe(true);
			});

			it('should allow Promise.all', () => {
				const result = validateAst('Promise.all([a, b])');
				expect(result.valid).toBe(true);
			});

			it('should allow object literal with "constructor" as key', () => {
				const result = validateAst('({ constructor: "value" })');
				expect(result.valid).toBe(true);
			});

			it('should allow new Date()', () => {
				const result = validateAst('new Date()');
				expect(result.valid).toBe(true);
			});

			it('should allow new Map()', () => {
				const result = validateAst('new Map()');
				expect(result.valid).toBe(true);
			});

			it('should allow new Set()', () => {
				const result = validateAst('new Set()');
				expect(result.valid).toBe(true);
			});

			it('should allow JSON methods', () => {
				const result = validateAst('JSON.stringify({ a: 1 })');
				expect(result.valid).toBe(true);
			});

			it('should allow Math methods', () => {
				const result = validateAst('Math.max(1, 2, 3)');
				expect(result.valid).toBe(true);
			});

			it('should allow Object.keys', () => {
				const result = validateAst('Object.keys(obj)');
				expect(result.valid).toBe(true);
			});

			it('should allow Array.isArray', () => {
				const result = validateAst('Array.isArray(x)');
				expect(result.valid).toBe(true);
			});

			it('should allow console.log', () => {
				const result = validateAst('console.log("hello")');
				expect(result.valid).toBe(true);
			});

			it('should allow template literals', () => {
				const result = validateAst('`Hello ${name}`');
				expect(result.valid).toBe(true);
			});

			it('should allow arrow functions', () => {
				const result = validateAst('const fn = (x) => x * 2');
				expect(result.valid).toBe(true);
			});

			it('should allow async/await', () => {
				const result = validateAst(
					'const result = await Promise.all([api.searchSymbols({ query: "a" }), api.searchSymbols({ query: "b" })])',
				);
				expect(result.valid).toBe(true);
			});

			it('should allow try/catch', () => {
				const result = validateAst(
					'try { await api.searchSymbols({ query: "test" }) } catch (e) { console.error(e) }',
				);
				expect(result.valid).toBe(true);
			});

			it('should allow for loops', () => {
				const result = validateAst(
					'for (let i = 0; i < 10; i++) { console.log(i) }',
				);
				expect(result.valid).toBe(true);
			});

			it('should allow for-of loops', () => {
				const result = validateAst(
					'for (const item of items) { console.log(item) }',
				);
				expect(result.valid).toBe(true);
			});

			it('should allow destructuring', () => {
				const result = validateAst('const { a, b } = obj');
				expect(result.valid).toBe(true);
			});

			it('should allow spread operator', () => {
				const result = validateAst('[...arr, 4, 5]');
				expect(result.valid).toBe(true);
			});
		});

		describe('parse error handling', () => {
			it('should return valid=true with parseError for invalid syntax', () => {
				const result = validateAst('const x = {');
				expect(result.valid).toBe(true);
				expect(result.parseError).toBeDefined();
				expect(result.parseError).toContain('AST parse warning');
			});

			it('should let VM catch syntax errors', () => {
				const result = validateAst('function foo( { }');
				expect(result.valid).toBe(true);
				expect(result.parseError).toBeDefined();
			});

			it('should handle empty code', () => {
				const result = validateAst('');
				expect(result.valid).toBe(true);
				expect(result.errors).toEqual([]);
			});

			it('should handle whitespace only', () => {
				const result = validateAst('   \n   ');
				expect(result.valid).toBe(true);
				expect(result.errors).toEqual([]);
			});
		});

		describe('location information in errors', () => {
			it('should include line and column in errors', () => {
				const result = validateAst('obj.constructor');
				expect(result.valid).toBe(false);
				expect(result.errors[0].location).toEqual({ line: 1, column: 0 });
			});

			it('should report correct location on second line', () => {
				const result = validateAst('const x = 1;\nobj.constructor');
				expect(result.valid).toBe(false);
				const error = result.errors.find(
					(e) => e.pattern === 'constructor-access',
				);
				expect(error?.location?.line).toBe(2);
			});

			it('should report correct column', () => {
				const result = validateAst('const x = obj.constructor');
				expect(result.valid).toBe(false);
				const error = result.errors.find(
					(e) => e.pattern === 'constructor-access',
				);
				expect(error?.location?.column).toBe(10);
			});
		});

		describe('complex attack vectors', () => {
			it('should block Function constructor via computed access', () => {
				const result = validateAst(
					'""["constructor"]["constructor"]("return this")()',
				);
				expect(result.valid).toBe(false);
			});

			it('should block prototype pollution attempt', () => {
				const result = validateAst('({}).__proto__.polluted = true');
				expect(result.valid).toBe(false);
			});

			it('should block chained prototype access', () => {
				const result = validateAst('Object.prototype.constructor');
				expect(result.valid).toBe(false);
			});

			it('should block globalThis as callee object', () => {
				const result = validateAst('globalThis.someMethod("code")');
				expect(result.valid).toBe(false);
			});

			it('should block Reflect.construct', () => {
				const result = validateAst('Reflect.construct(Array, [])');
				expect(result.valid).toBe(false);
			});

			it('should block new Proxy', () => {
				const result = validateAst('new Proxy({}, {})');
				expect(result.valid).toBe(false);
			});
		});
	});
});
