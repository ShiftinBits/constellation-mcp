/**
 * Auto-Return Transformation (SB-151)
 *
 * Detects the last statement in user code and prepends/appends `return` as needed,
 * enabling REPL-like behavior in Code Mode. This eliminates the most common LLM
 * failure mode: forgetting to add `return` before the final expression.
 *
 * Design: Uses acorn AST parsing with source-position slicing to handle all
 * destructuring patterns uniformly without AST reconstruction.
 */

import { parse } from 'acorn';
import type { Program, VariableDeclaration } from 'acorn';

const CONTROL_FLOW_TYPES = new Set([
	'IfStatement',
	'ForStatement',
	'ForInStatement',
	'ForOfStatement',
	'WhileStatement',
	'DoWhileStatement',
	'TryStatement',
	'SwitchStatement',
	'FunctionDeclaration',
	'ClassDeclaration',
	'ThrowStatement',
	'LabeledStatement',
]);

/**
 * Add an implicit return to the last expression if no explicit return is present.
 *
 * Handles:
 * - ExpressionStatement: prepends `return ` at statement start
 * - VariableDeclaration: appends `return <pattern>;` using source-position slicing.
 *   For multi-declarator statements (`const a = 1, b = 2`), returns the last declarator only.
 *   Destructuring patterns (`[a, b]`, `{ x, y }`) are preserved via source slicing.
 * - Control flow / explicit return: no modification
 * - Parse errors: returns original code (graceful fallback)
 */
export function addAutoReturn(code: string): string {
	let ast: Program;
	try {
		ast = parse(code, {
			ecmaVersion: 'latest',
			allowAwaitOutsideFunction: true,
			allowReturnOutsideFunction: true,
		}) as Program;
	} catch {
		return code;
	}

	const body = ast.body;
	if (body.length === 0) return code;

	// If any top-level statement is a ReturnStatement, don't modify
	if (body.some((stmt) => stmt.type === 'ReturnStatement')) return code;

	// Find last non-empty statement (skip trailing EmptyStatements from extra semicolons)
	let lastStmt: (typeof body)[number] | null = null;
	for (let i = body.length - 1; i >= 0; i--) {
		if (body[i].type !== 'EmptyStatement') {
			lastStmt = body[i];
			break;
		}
	}
	if (!lastStmt) return code;

	// Skip control flow types
	if (CONTROL_FLOW_TYPES.has(lastStmt.type)) return code;

	// ExpressionStatement: prepend "return " at statement start
	if (lastStmt.type === 'ExpressionStatement') {
		const before = code.substring(0, lastStmt.start);
		const expr = code.substring(lastStmt.start);
		return `${before}return ${expr}`;
	}

	// VariableDeclaration: append "return <pattern>;" using source-position slicing
	// For multi-declarator statements (const a = 1, b = 2), returns the last declarator only.
	if (lastStmt.type === 'VariableDeclaration') {
		const decl = lastStmt as VariableDeclaration;
		if (decl.declarations.length === 0) return code;
		const lastDeclarator = decl.declarations[decl.declarations.length - 1];
		const patternText = code.slice(
			lastDeclarator.id.start,
			lastDeclarator.id.end,
		);
		return `${code}\nreturn ${patternText};`;
	}

	return code;
}
