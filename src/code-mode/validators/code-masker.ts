/**
 * Code Masker for the Regex-based Dangerous Pattern Sweep
 *
 * Blanks out string literal bodies, template literal static text, and
 * comments so the regex-based dangerous-pattern sweep in
 * `sandbox.ts#validateCode` cannot false-positive on identifiers that merely
 * *appear inside* a string/comment rather than being executed (SB-1100).
 *
 * Real dangerous identifier usage in executable code (including expressions
 * interpolated into template literals) is left intact for the regex sweep,
 * and is independently enforced by the AST-based validator regardless of
 * what this masking does.
 */

import { parse } from 'acorn';
import type { Comment, Node } from 'acorn';
import { walk } from './ast-walker.js';

interface StringLiteralNode extends Node {
	type: 'Literal';
	value: unknown;
}

function isStringLiteral(node: Node): node is StringLiteralNode {
	return (
		node.type === 'Literal' &&
		typeof (node as StringLiteralNode).value === 'string'
	);
}

/** Replace `code[start:end)` with spaces, preserving newlines for line integrity. */
function blank(code: string, start: number, end: number): string {
	let replacement = '';
	for (let i = start; i < end; i++) {
		replacement += code[i] === '\n' ? '\n' : ' ';
	}
	return code.slice(0, start) + replacement + code.slice(end);
}

/**
 * Blank out string literal bodies, template literal static text, and
 * comments so a regex sweep over the result only sees executable
 * identifiers/keywords. Falls back to the original, unmodified code when
 * parsing fails — the AST validator and VM handle syntax errors separately.
 */
export function maskNonExecutableSpans(code: string): string {
	const comments: Comment[] = [];
	let ast: Node;

	try {
		ast = parse(code, {
			ecmaVersion: 'latest',
			allowAwaitOutsideFunction: true,
			allowReturnOutsideFunction: true,
			onComment: comments,
		});
	} catch {
		return code;
	}

	const spans: Array<[number, number]> = comments.map(
		(comment): [number, number] => [comment.start, comment.end],
	);

	walk(ast, {
		enter(node) {
			if (isStringLiteral(node) || node.type === 'TemplateElement') {
				spans.push([node.start, node.end]);
			}
		},
	});

	// Blank spans back-to-front so earlier offsets stay valid as we mutate.
	spans.sort((a, b) => b[0] - a[0]);

	let masked = code;
	for (const [start, end] of spans) {
		masked = blank(masked, start, end);
	}

	return masked;
}
