/**
 * Code Masker Unit Tests
 *
 * Adversarial coverage for the span masker that blinds the regex sweep to
 * string/template/comment contents: the security contract is that executable
 * code — including template-literal interpolations — is NEVER masked, and
 * that masking preserves length and line structure.
 *
 * The `eval(` / `process.` / `require(` occurrences below are inert string
 * fixtures fed to the masker; nothing in this file executes them.
 */

import { describe, it, expect } from '@jest/globals';
import { maskNonExecutableSpans } from '../../../../src/code-mode/validators/code-masker.js';

describe('maskNonExecutableSpans', () => {
	it('preserves code length exactly (1:1 space substitution)', () => {
		const code = 'const a = "process.exit()"; // eval(x)\nreturn a;';
		expect(maskNonExecutableSpans(code)).toHaveLength(code.length);
	});

	it('masks string literal bodies so the sweep cannot see them', () => {
		const masked = maskNonExecutableSpans('const a = "child_process";');
		expect(masked).not.toContain('child_process');
	});

	it('masks the full body of a string containing an escaped quote', () => {
		const masked = maskNonExecutableSpans(
			"const a = 'it\\'s process.exit()'; return a;",
		);
		expect(masked).not.toContain('process.exit');
	});

	it('does NOT mask template-literal interpolations (executable code)', () => {
		const masked = maskNonExecutableSpans('return `safe ${process.exit()}`;');
		expect(masked).toContain('process.exit()');
		expect(masked).not.toContain('safe');
	});

	it('does NOT mask interpolations inside nested template literals', () => {
		const masked = maskNonExecutableSpans(
			'return `outer ${`inner ${process.env.X}`}`;',
		);
		expect(masked).toContain('process.env.X');
	});

	it('leaves regex literals untouched, keeping adjacent code visible', () => {
		const code = 'const r = /[\'"]/; process.exit();';
		const masked = maskNonExecutableSpans(code);
		expect(masked).toContain('/[\'"]/');
		expect(masked).toContain('process.exit()');
	});

	it('masks comments but not the code around them', () => {
		const masked = maskNonExecutableSpans(
			'// require("fs")\nreturn eval_free();',
		);
		expect(masked).not.toContain('require');
		expect(masked).toContain('return eval_free();');
	});

	it('preserves newlines inside multi-line template text (line integrity)', () => {
		const code = 'const t = `line one process.\nline two eval(`;\nreturn t;';
		const masked = maskNonExecutableSpans(code);
		expect(masked).toHaveLength(code.length);
		expect(masked.split('\n')).toHaveLength(code.split('\n').length);
		expect(masked).not.toContain('process.');
		expect(masked).not.toContain('eval(');
	});

	it('falls back to the raw, unmasked code when parsing fails (fail-safe: over-blocks)', () => {
		const code = 'const broken = "unterminated; process.exit();';
		expect(maskNonExecutableSpans(code)).toBe(code);
	});

	it('leaves real member-expression code next to a lookalike string visible', () => {
		const masked = maskNonExecutableSpans(
			'const doc = "fs is dangerous"; fs.readFileSync("/etc/passwd");',
		);
		expect(masked).not.toContain('fs is dangerous');
		expect(masked).toContain('fs.readFileSync(');
	});
});
