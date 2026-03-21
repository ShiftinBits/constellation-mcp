/**
 * AST Walker for ESTree-compatible ASTs
 * Custom tree walker implementation (no acorn-walk dependency)
 */

import type { Node } from 'acorn';

export interface NodeVisitor {
	enter?: (node: Node, parent: Node | null) => void;
	leave?: (node: Node, parent: Node | null) => void;
}

export type WalkOptions = NodeVisitor;

const CHILD_KEYS: Record<string, string[]> = {
	Program: ['body'],
	BlockStatement: ['body'],
	StaticBlock: ['body'],
	ExpressionStatement: ['expression'],
	IfStatement: ['test', 'consequent', 'alternate'],
	SwitchStatement: ['discriminant', 'cases'],
	SwitchCase: ['test', 'consequent'],
	WhileStatement: ['test', 'body'],
	DoWhileStatement: ['body', 'test'],
	ForStatement: ['init', 'test', 'update', 'body'],
	ForInStatement: ['left', 'right', 'body'],
	ForOfStatement: ['left', 'right', 'body'],
	ReturnStatement: ['argument'],
	ThrowStatement: ['argument'],
	TryStatement: ['block', 'handler', 'finalizer'],
	CatchClause: ['param', 'body'],
	WithStatement: ['object', 'body'],
	LabeledStatement: ['label', 'body'],
	BreakStatement: ['label'],
	ContinueStatement: ['label'],
	VariableDeclaration: ['declarations'],
	VariableDeclarator: ['id', 'init'],
	FunctionDeclaration: ['id', 'params', 'body'],
	FunctionExpression: ['id', 'params', 'body'],
	ArrowFunctionExpression: ['params', 'body'],
	ClassDeclaration: ['id', 'superClass', 'body'],
	ClassExpression: ['id', 'superClass', 'body'],
	ClassBody: ['body'],
	MethodDefinition: ['key', 'value'],
	PropertyDefinition: ['key', 'value'],
	ImportDeclaration: ['specifiers', 'source'],
	ImportSpecifier: ['imported', 'local'],
	ImportDefaultSpecifier: ['local'],
	ImportNamespaceSpecifier: ['local'],
	ExportNamedDeclaration: ['declaration', 'specifiers', 'source'],
	ExportDefaultDeclaration: ['declaration'],
	ExportAllDeclaration: ['source'],
	ExportSpecifier: ['local', 'exported'],
	AwaitExpression: ['argument'],
	YieldExpression: ['argument'],
	SpreadElement: ['argument'],
	RestElement: ['argument'],
	ArrayExpression: ['elements'],
	ArrayPattern: ['elements'],
	ObjectExpression: ['properties'],
	ObjectPattern: ['properties'],
	Property: ['key', 'value'],
	AssignmentPattern: ['left', 'right'],
	MemberExpression: ['object', 'property'],
	CallExpression: ['callee', 'arguments'],
	NewExpression: ['callee', 'arguments'],
	SequenceExpression: ['expressions'],
	AssignmentExpression: ['left', 'right'],
	BinaryExpression: ['left', 'right'],
	LogicalExpression: ['left', 'right'],
	UnaryExpression: ['argument'],
	UpdateExpression: ['argument'],
	ConditionalExpression: ['test', 'consequent', 'alternate'],
	TemplateLiteral: ['quasis', 'expressions'],
	TaggedTemplateExpression: ['tag', 'quasi'],
	TemplateElement: [],
	ChainExpression: ['expression'],
	ImportExpression: ['source'],
	MetaProperty: ['meta', 'property'],
	Identifier: [],
	Literal: [],
	ThisExpression: [],
	Super: [],
	DebuggerStatement: [],
	EmptyStatement: [],
};

export function getChildNodes(node: Node): Node[] {
	const children: Node[] = [];
	const keys = CHILD_KEYS[node.type] || [];

	for (const key of keys) {
		const child = (node as unknown as Record<string, unknown>)[key];
		if (child === null || child === undefined) {
			continue;
		}
		if (Array.isArray(child)) {
			for (const item of child) {
				if (item && typeof item === 'object' && 'type' in item) {
					children.push(item as Node);
				}
			}
		} else if (typeof child === 'object' && 'type' in child) {
			children.push(child as Node);
		}
	}

	return children;
}

export function walk(node: Node, options: WalkOptions): void {
	walkNode(node, null, options);
}

function walkNode(node: Node, parent: Node | null, options: WalkOptions): void {
	if (options.enter) {
		options.enter(node, parent);
	}

	const children = getChildNodes(node);
	for (const child of children) {
		walkNode(child, node, options);
	}

	if (options.leave) {
		options.leave(node, parent);
	}
}
