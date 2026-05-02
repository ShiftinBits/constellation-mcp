import { describe, it, expect } from '@jest/globals';
import { UnsupportedLanguageError } from '../../../src/client/constellation-client.js';

describe('UnsupportedLanguageError', () => {
	it('should be an Error subclass', () => {
		const err = new UnsupportedLanguageError('foo.py', '.py', new Set(['.ts']));
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(UnsupportedLanguageError);
	});

	it('should carry the filePath, extension, and configuredExtensions', () => {
		const configured = new Set(['.ts', '.tsx']);
		const err = new UnsupportedLanguageError('lib/foo.py', '.py', configured);
		expect(err.filePath).toBe('lib/foo.py');
		expect(err.extension).toBe('.py');
		expect(err.configuredExtensions).toBe(configured);
	});

	it('should expose a stable code property', () => {
		const err = new UnsupportedLanguageError('x.py', '.py', new Set());
		expect(err.code).toBe('UNSUPPORTED_LANGUAGE');
	});

	it('should set name to UnsupportedLanguageError for stack-trace clarity', () => {
		const err = new UnsupportedLanguageError('x.py', '.py', new Set());
		expect(err.name).toBe('UnsupportedLanguageError');
	});

	it('should produce a message naming the filePath, extension, and configured extensions', () => {
		const err = new UnsupportedLanguageError(
			'lib/foo.py',
			'.py',
			new Set(['.ts', '.tsx', '.js', '.jsx']),
		);
		expect(err.message).toContain("'.py'");
		expect(err.message).toContain("'lib/foo.py'");
		expect(err.message).toContain('.ts');
		expect(err.message).toContain('.tsx');
		expect(err.message).toContain('constellation.json');
	});

	it('should sort configured extensions in the message for deterministic output', () => {
		const err = new UnsupportedLanguageError(
			'foo.py',
			'.py',
			new Set(['.tsx', '.ts', '.jsx', '.js']),
		);
		expect(err.message).toMatch(/\.js,\s*\.jsx,\s*\.ts,\s*\.tsx/);
	});

	it('should fall back to "(none)" when configured extensions is empty', () => {
		const err = new UnsupportedLanguageError('foo.py', '.py', new Set());
		expect(err.message).toContain('(none)');
	});
});
