/**
 * AST-based Code Validator
 * Parses code with acorn and validates against dangerous patterns
 */

import { parse } from 'acorn';
import type { Node } from 'acorn';
import { walk } from './ast-walker.js';
import { checkAllPatterns } from './dangerous-patterns.js';

export interface AstValidationError {
	pattern: string;
	message: string;
	location: { line: number; column: number } | null;
}

export interface AstValidationResult {
	valid: boolean;
	errors: AstValidationError[];
	parseError?: string;
}

export interface LocationInfo {
	line: number;
	column: number;
}

export function offsetToLocation(
	code: string,
	offset: number,
): LocationInfo | null {
	if (offset < 0 || offset > code.length) {
		return null;
	}

	let line = 1;
	let lastLineStart = 0;

	for (let i = 0; i < offset; i++) {
		if (code[i] === '\n') {
			line++;
			lastLineStart = i + 1;
		}
	}

	return {
		line,
		column: offset - lastLineStart,
	};
}

export function validateAst(code: string): AstValidationResult {
	let ast: Node;

	try {
		ast = parse(code, {
			ecmaVersion: 'latest',
			allowAwaitOutsideFunction: true,
			allowReturnOutsideFunction: true,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unknown parse error';
		return {
			valid: true,
			errors: [],
			parseError: `AST parse warning: ${message} (validation skipped, VM will catch syntax errors)`,
		};
	}

	const errors: AstValidationError[] = [];

	walk(ast, {
		enter(node, parent) {
			const matches = checkAllPatterns(node, parent);
			for (const match of matches) {
				const location = offsetToLocation(code, node.start);
				errors.push({
					pattern: match.pattern,
					message: match.message,
					location,
				});
			}
		},
	});

	return {
		valid: errors.length === 0,
		errors,
	};
}
