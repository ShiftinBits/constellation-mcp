/**
 * Auto-Return Transformation Unit Tests (SB-151)
 *
 * Tests for the addAutoReturn() function that detects the last statement
 * in user code and prepends/appends `return` as needed.
 */

import { describe, it, expect } from '@jest/globals';
import { addAutoReturn } from '../../../src/code-mode/auto-return.js';

describe('addAutoReturn', () => {
	describe('ExpressionStatement auto-return', () => {
		it('should auto-return a bare await expression', () => {
			const code = 'await api.searchSymbols({ query: "x" })';
			const result = addAutoReturn(code);
			expect(result).toBe('return await api.searchSymbols({ query: "x" })');
		});

		it('should auto-return a method chain', () => {
			const code =
				'const r = await api.searchSymbols({ query: "x" });\nr.symbols';
			const result = addAutoReturn(code);
			expect(result).toBe(
				'const r = await api.searchSymbols({ query: "x" });\nreturn r.symbols',
			);
		});

		it('should auto-return console.log', () => {
			const code = 'console.log("hello")';
			const result = addAutoReturn(code);
			expect(result).toBe('return console.log("hello")');
		});

		it('should auto-return expression with trailing semicolons', () => {
			const code = 'await api.ping();';
			const result = addAutoReturn(code);
			expect(result).toBe('return await api.ping();');
		});

		it('should auto-return a numeric literal expression', () => {
			const code = '42';
			const result = addAutoReturn(code);
			expect(result).toBe('return 42');
		});

		it('should auto-return a string literal expression', () => {
			const code = '"hello world"';
			const result = addAutoReturn(code);
			expect(result).toBe('return "hello world"');
		});

		it('should auto-return the last expression after prior statements', () => {
			const code = 'const x = 1;\nconst y = 2;\nx + y';
			const result = addAutoReturn(code);
			expect(result).toBe('const x = 1;\nconst y = 2;\nreturn x + y');
		});
	});

	describe('VariableDeclaration auto-return', () => {
		it('should auto-return a simple identifier from const declaration', () => {
			const code = 'const result = await api.searchSymbols({ query: "x" })';
			const result = addAutoReturn(code);
			expect(result).toBe(
				'const result = await api.searchSymbols({ query: "x" })\nreturn result;',
			);
		});

		it('should auto-return array destructuring pattern', () => {
			const code = 'const [a, b] = await Promise.all([p1, p2])';
			const result = addAutoReturn(code);
			expect(result).toBe(
				'const [a, b] = await Promise.all([p1, p2])\nreturn [a, b];',
			);
		});

		it('should auto-return object destructuring pattern', () => {
			const code =
				'const { x, y } = await api.getSymbolDetails({ symbolId: "123" })';
			const result = addAutoReturn(code);
			expect(result).toBe(
				'const { x, y } = await api.getSymbolDetails({ symbolId: "123" })\nreturn { x, y };',
			);
		});

		it('should auto-return the last declarator in multi-variable declaration', () => {
			const code = 'const a = 1, b = 2';
			const result = addAutoReturn(code);
			expect(result).toBe('const a = 1, b = 2\nreturn b;');
		});

		it('should auto-return let declarations', () => {
			const code = 'let x = 42';
			const result = addAutoReturn(code);
			expect(result).toBe('let x = 42\nreturn x;');
		});

		it('should auto-return var declarations', () => {
			const code = 'var x = 42';
			const result = addAutoReturn(code);
			expect(result).toBe('var x = 42\nreturn x;');
		});
	});

	describe('explicit return present', () => {
		it('should not modify code with top-level return', () => {
			const code = 'return 42';
			const result = addAutoReturn(code);
			expect(result).toBe('return 42');
		});

		it('should not modify code with return in complex flow', () => {
			const code =
				'const x = await api.ping();\nreturn { status: "ok", result: x }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify code with return as first statement', () => {
			const code = 'return await api.searchSymbols({ query: "x" })';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});
	});

	describe('control flow last statements (no modification)', () => {
		it('should not modify if the last statement is IfStatement', () => {
			const code = 'if (true) { console.log("yes"); }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is ForStatement', () => {
			const code = 'for (let i = 0; i < 10; i++) { console.log(i); }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is ForOfStatement', () => {
			const code =
				'const items = [1, 2, 3];\nfor (const item of items) { console.log(item); }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is ForInStatement', () => {
			const code =
				'const obj = { a: 1 };\nfor (const key in obj) { console.log(key); }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is WhileStatement', () => {
			const code = 'let i = 0;\nwhile (i < 10) { i++; }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is DoWhileStatement', () => {
			const code = 'let i = 0;\ndo { i++; } while (i < 10)';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is TryStatement', () => {
			const code = 'try { doSomething(); } catch (e) { handleError(e); }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is SwitchStatement', () => {
			const code = 'switch (x) { case 1: break; default: break; }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is FunctionDeclaration', () => {
			const code = 'function foo() { return 42; }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is ThrowStatement', () => {
			const code = 'throw new Error("oops")';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is ClassDeclaration', () => {
			const code = 'class Foo { constructor() {} }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should not modify if the last statement is LabeledStatement', () => {
			const code = 'outer: for (let i = 0; i < 3; i++) { break outer; }';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});
	});

	describe('graceful fallback on parse errors', () => {
		it('should return original code on syntax error', () => {
			const code = 'const x = {';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should return original code on incomplete expression', () => {
			const code = 'return (';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});
	});

	describe('edge cases', () => {
		it('should return empty code unchanged', () => {
			const code = '';
			const result = addAutoReturn(code);
			expect(result).toBe(code);
		});

		it('should handle trailing empty statements (;;)', () => {
			const code = 'const x = 42;;';
			const result = addAutoReturn(code);
			// Last non-empty statement is VariableDeclaration
			expect(result).toBe('const x = 42;;\nreturn x;');
		});

		it('should not be tricked by return in string literals', () => {
			const code = 'const msg = "return value";\nmsg';
			const result = addAutoReturn(code);
			// Has no actual ReturnStatement, last statement is ExpressionStatement
			expect(result).toBe('const msg = "return value";\nreturn msg');
		});

		it('should not be tricked by return nested inside arrow functions', () => {
			const code = 'const fn = () => { return 42; };\nfn()';
			const result = addAutoReturn(code);
			// The return is inside an arrow function, not at top level
			expect(result).toBe('const fn = () => { return 42; };\nreturn fn()');
		});

		it('should handle code with only whitespace', () => {
			const code = '   \n  \n  ';
			const result = addAutoReturn(code);
			// Acorn parses this as empty body
			expect(result).toBe(code);
		});

		it('should handle multiline expressions', () => {
			const code = `const search = await api.searchSymbols({ query: "x" });
search
  .symbols
  .map(s => s.name)`;
			const result = addAutoReturn(code);
			expect(result).toContain('return search');
		});
	});
});
