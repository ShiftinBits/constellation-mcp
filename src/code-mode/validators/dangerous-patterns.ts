/**
 * Dangerous Pattern Definitions for AST-based Code Validation
 * Detects sandbox escape vectors via constructor chains and computed property access
 */

import type { Node } from 'acorn';

export const DANGEROUS_PROPERTIES = new Set([
	'constructor',
	'__proto__',
	'prototype',
	'__defineGetter__',
	'__defineSetter__',
	'__lookupGetter__',
	'__lookupSetter__',
]);

export const DANGEROUS_GLOBALS = new Set([
	'process',
	'global',
	'globalThis',
	'require',
	'module',
	'exports',
	'__dirname',
	'__filename',
	'Buffer',
	'eval',
	'Function',
	'Proxy',
	'Reflect',
]);

export interface PatternMatch {
	pattern: string;
	message: string;
	node: Node;
}

export interface PatternChecker {
	id: string;
	description: string;
	check: (node: Node, parent: Node | null) => PatternMatch | null;
}

interface MemberExpressionNode extends Node {
	type: 'MemberExpression';
	object: Node;
	property: Node;
	computed: boolean;
}

interface IdentifierNode extends Node {
	type: 'Identifier';
	name: string;
}

interface LiteralNode extends Node {
	type: 'Literal';
	value: string | number | boolean | null | RegExp | bigint;
}

function isMemberExpression(node: Node): node is MemberExpressionNode {
	return node.type === 'MemberExpression';
}

function isIdentifier(node: Node): node is IdentifierNode {
	return node.type === 'Identifier';
}

function isLiteral(node: Node): node is LiteralNode {
	return node.type === 'Literal';
}

function isPropertyKey(node: Node, parent: Node | null): boolean {
	if (!parent) return false;
	if (parent.type === 'Property') {
		const prop = parent as Node & { key: Node; computed: boolean };
		return prop.key === node && !prop.computed;
	}
	if (
		parent.type === 'MethodDefinition' ||
		parent.type === 'PropertyDefinition'
	) {
		const def = parent as Node & { key: Node; computed: boolean };
		return def.key === node && !def.computed;
	}
	return false;
}

function getPropertyName(node: MemberExpressionNode): string | null {
	if (!node.computed && isIdentifier(node.property)) {
		return node.property.name;
	}
	if (
		node.computed &&
		isLiteral(node.property) &&
		typeof node.property.value === 'string'
	) {
		return node.property.value;
	}
	return null;
}

export const DANGEROUS_PATTERNS: PatternChecker[] = [
	{
		id: 'constructor-access',
		description: 'Block .constructor access',
		check(node: Node): PatternMatch | null {
			if (!isMemberExpression(node)) return null;
			const propName = getPropertyName(node);
			if (propName === 'constructor') {
				return {
					pattern: 'constructor-access',
					message:
						'Access to .constructor is not allowed (potential sandbox escape)',
					node,
				};
			}
			return null;
		},
	},
	{
		id: 'proto-access',
		description: 'Block .__proto__ access',
		check(node: Node): PatternMatch | null {
			if (!isMemberExpression(node)) return null;
			const propName = getPropertyName(node);
			if (propName === '__proto__') {
				return {
					pattern: 'proto-access',
					message:
						'Access to .__proto__ is not allowed (prototype pollution risk)',
					node,
				};
			}
			return null;
		},
	},
	{
		id: 'prototype-access',
		description: 'Block Object.prototype etc.',
		check(node: Node): PatternMatch | null {
			if (!isMemberExpression(node)) return null;
			const propName = getPropertyName(node);
			if (propName === 'prototype') {
				return {
					pattern: 'prototype-access',
					message:
						'Access to .prototype is not allowed (potential sandbox escape)',
					node,
				};
			}
			return null;
		},
	},
	{
		id: 'dangerous-global',
		description: 'Block dangerous globals',
		check(node: Node, parent: Node | null): PatternMatch | null {
			if (!isIdentifier(node)) return null;
			if (!DANGEROUS_GLOBALS.has(node.name)) return null;
			if (isPropertyKey(node, parent)) return null;
			if (
				parent &&
				isMemberExpression(parent) &&
				parent.property === node &&
				!parent.computed
			) {
				return null;
			}
			return {
				pattern: 'dangerous-global',
				message: `Access to '${node.name}' is not allowed (dangerous global)`,
				node,
			};
		},
	},
	{
		id: 'dynamic-import',
		description: 'Block import()',
		check(node: Node): PatternMatch | null {
			if (node.type === 'ImportExpression') {
				return {
					pattern: 'dynamic-import',
					message: 'Dynamic import() is not allowed',
					node,
				};
			}
			return null;
		},
	},
	{
		id: 'with-statement',
		description: 'Block with statement',
		check(node: Node): PatternMatch | null {
			if (node.type === 'WithStatement') {
				return {
					pattern: 'with-statement',
					message: 'The with statement is not allowed',
					node,
				};
			}
			return null;
		},
	},
	{
		id: 'computed-dangerous-property',
		description: 'Block obj["constructor"] etc.',
		check(node: Node): PatternMatch | null {
			if (!isMemberExpression(node)) return null;
			if (!node.computed) return null;
			if (isLiteral(node.property) && typeof node.property.value === 'string') {
				if (DANGEROUS_PROPERTIES.has(node.property.value)) {
					return {
						pattern: 'computed-dangerous-property',
						message: `Computed access to '${node.property.value}' is not allowed (potential sandbox escape)`,
						node,
					};
				}
			}
			return null;
		},
	},
	{
		id: 'legacy-property-access',
		description: 'Block __defineGetter__, __defineSetter__, etc.',
		check(node: Node): PatternMatch | null {
			if (!isMemberExpression(node)) return null;
			const propName = getPropertyName(node);
			if (
				propName &&
				DANGEROUS_PROPERTIES.has(propName) &&
				propName !== 'constructor' &&
				propName !== '__proto__' &&
				propName !== 'prototype'
			) {
				return {
					pattern: 'legacy-property-access',
					message: `Access to .${propName} is not allowed (legacy property manipulation)`,
					node,
				};
			}
			return null;
		},
	},
	{
		id: 'computed-dynamic-property',
		description:
			'Warn on dynamic computed property access (defense-in-depth, SB-258)',
		check(node: Node): PatternMatch | null {
			if (!isMemberExpression(node)) return null;
			if (!node.computed) return null;
			// String/numeric literal computed access is handled by computed-dangerous-property
			if (isLiteral(node.property)) return null;
			return {
				pattern: 'computed-dynamic-property',
				message:
					'Dynamic computed property access detected. ' +
					'This is allowed but logged as a warning for security auditing. ' +
					'Use dot notation or literal keys when possible.',
				node,
			};
		},
	},
];

export function checkAllPatterns(
	node: Node,
	parent: Node | null,
): PatternMatch[] {
	const matches: PatternMatch[] = [];
	for (const pattern of DANGEROUS_PATTERNS) {
		const match = pattern.check(node, parent);
		if (match) {
			matches.push(match);
		}
	}
	return matches;
}
