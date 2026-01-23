/**
 * AST Walker Unit Tests
 */

import { describe, it, expect } from '@jest/globals';
import { parse } from 'acorn';
import {
	walk,
	getChildNodes,
} from '../../../../src/code-mode/validators/ast-walker.js';
import type { Node } from 'acorn';

const parseCode = (code: string): Node =>
	parse(code, { ecmaVersion: 'latest', allowAwaitOutsideFunction: true });

describe('ast-walker', () => {
	describe('walk', () => {
		it('should visit all nodes in order', () => {
			const code = 'const x = 1;';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toEqual([
				'Program',
				'VariableDeclaration',
				'VariableDeclarator',
				'Identifier',
				'Literal',
			]);
		});

		it('should provide parent context to visitors', () => {
			const code = 'const x = 1;';
			const ast = parseCode(code);
			const parentTypes: (string | null)[] = [];

			walk(ast, {
				enter(node, parent) {
					parentTypes.push(parent?.type || null);
				},
			});

			expect(parentTypes).toEqual([
				null,
				'Program',
				'VariableDeclaration',
				'VariableDeclarator',
				'VariableDeclarator',
			]);
		});

		it('should call leave after enter for each node', () => {
			const code = 'const x = 1;';
			const ast = parseCode(code);
			const events: string[] = [];

			walk(ast, {
				enter(node) {
					events.push(`enter:${node.type}`);
				},
				leave(node) {
					events.push(`leave:${node.type}`);
				},
			});

			expect(events).toEqual([
				'enter:Program',
				'enter:VariableDeclaration',
				'enter:VariableDeclarator',
				'enter:Identifier',
				'leave:Identifier',
				'enter:Literal',
				'leave:Literal',
				'leave:VariableDeclarator',
				'leave:VariableDeclaration',
				'leave:Program',
			]);
		});

		it('should handle nested structures', () => {
			const code = 'const arr = [1, 2, { a: 3 }];';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('ArrayExpression');
			expect(visited).toContain('ObjectExpression');
			expect(visited).toContain('Property');
		});

		it('should handle function expressions', () => {
			const code = 'const fn = function(a, b) { return a + b; };';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('FunctionExpression');
			expect(visited).toContain('ReturnStatement');
			expect(visited).toContain('BinaryExpression');
		});

		it('should handle arrow functions', () => {
			const code = 'const fn = (x) => x * 2;';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('ArrowFunctionExpression');
			expect(visited).toContain('BinaryExpression');
		});

		it('should handle MemberExpression', () => {
			const code = 'obj.prop.nested';
			const ast = parseCode(code);
			const memberExpressions: Node[] = [];

			walk(ast, {
				enter(node) {
					if (node.type === 'MemberExpression') {
						memberExpressions.push(node);
					}
				},
			});

			expect(memberExpressions.length).toBe(2);
		});

		it('should handle CallExpression', () => {
			const code = 'api.searchSymbols({ query: "test" })';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('CallExpression');
			expect(visited).toContain('MemberExpression');
			expect(visited).toContain('ObjectExpression');
		});

		it('should handle NewExpression', () => {
			const code = 'new Date()';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('NewExpression');
			expect(visited).toContain('Identifier');
		});

		it('should handle conditional expressions', () => {
			const code = 'x ? a : b';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('ConditionalExpression');
		});

		it('should handle template literals', () => {
			const code = '`hello ${name}`';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('TemplateLiteral');
			expect(visited).toContain('TemplateElement');
		});

		it('should handle await expressions', () => {
			const code = 'await api.searchSymbols()';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('AwaitExpression');
			expect(visited).toContain('CallExpression');
		});

		it('should handle try-catch', () => {
			const code = 'try { x } catch (e) { y }';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('TryStatement');
			expect(visited).toContain('CatchClause');
		});

		it('should handle for loops', () => {
			const code = 'for (let i = 0; i < 10; i++) { x }';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('ForStatement');
			expect(visited).toContain('UpdateExpression');
		});

		it('should handle for-of loops', () => {
			const code = 'for (const x of arr) { y }';
			const ast = parseCode(code);
			const visited: string[] = [];

			walk(ast, {
				enter(node) {
					visited.push(node.type);
				},
			});

			expect(visited).toContain('ForOfStatement');
		});
	});

	describe('getChildNodes', () => {
		it('should return empty array for leaf nodes', () => {
			const code = 'x';
			const ast = parseCode(code);
			let identifier: Node | null = null;

			walk(ast, {
				enter(node) {
					if (node.type === 'Identifier') {
						identifier = node;
					}
				},
			});

			expect(getChildNodes(identifier!)).toEqual([]);
		});

		it('should return empty array for Literal', () => {
			const code = '42';
			const ast = parseCode(code);
			let literal: Node | null = null;

			walk(ast, {
				enter(node) {
					if (node.type === 'Literal') {
						literal = node;
					}
				},
			});

			expect(getChildNodes(literal!)).toEqual([]);
		});

		it('should return children for ObjectExpression', () => {
			const code = '({ a: 1, b: 2 })';
			const ast = parseCode(code);
			let objectExpr: Node | null = null;

			walk(ast, {
				enter(node) {
					if (node.type === 'ObjectExpression') {
						objectExpr = node;
					}
				},
			});

			const children = getChildNodes(objectExpr!);
			expect(children.length).toBe(2);
			expect(children.every((c) => c.type === 'Property')).toBe(true);
		});

		it('should return children for ArrayExpression', () => {
			const code = '[1, 2, 3]';
			const ast = parseCode(code);
			let arrayExpr: Node | null = null;

			walk(ast, {
				enter(node) {
					if (node.type === 'ArrayExpression') {
						arrayExpr = node;
					}
				},
			});

			const children = getChildNodes(arrayExpr!);
			expect(children.length).toBe(3);
			expect(children.every((c) => c.type === 'Literal')).toBe(true);
		});

		it('should skip null elements in arrays', () => {
			const code = '[1, , 3]';
			const ast = parseCode(code);
			let arrayExpr: Node | null = null;

			walk(ast, {
				enter(node) {
					if (node.type === 'ArrayExpression') {
						arrayExpr = node;
					}
				},
			});

			const children = getChildNodes(arrayExpr!);
			expect(children.length).toBe(2);
		});

		it('should handle unknown node types', () => {
			const fakeNode = { type: 'UnknownNodeType', start: 0, end: 0 } as Node;
			expect(getChildNodes(fakeNode)).toEqual([]);
		});
	});
});
