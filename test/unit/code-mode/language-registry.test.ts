import { describe, it, expect } from '@jest/globals';
import {
	extractExtension,
	resolveConfiguredExtensions,
} from '../../../src/code-mode/language-registry.js';
import { ConstellationConfig } from '../../../src/config/config.js';

describe('extractExtension', () => {
	describe('basic extraction', () => {
		it('should return .ts for foo.ts', () => {
			expect(extractExtension('foo.ts')).toBe('.ts');
		});

		it('should return .py for src/foo.py', () => {
			expect(extractExtension('src/foo.py')).toBe('.py');
		});

		it('should return .py for absolute paths', () => {
			expect(extractExtension('/abs/path/foo.py')).toBe('.py');
		});

		it('should lowercase the extension', () => {
			expect(extractExtension('foo.PY')).toBe('.py');
			expect(extractExtension('/abs/foo.PY')).toBe('.py');
		});

		it('should take the last dot for multi-dot basenames', () => {
			expect(extractExtension('foo.spec.ts')).toBe('.ts');
			expect(extractExtension('bar.d.ts')).toBe('.ts');
		});

		it('should return .gz for foo.tar.gz (last-dot rule)', () => {
			expect(extractExtension('foo.tar.gz')).toBe('.gz');
		});
	});

	describe('separator handling', () => {
		it('should handle Windows backslash separators', () => {
			expect(extractExtension('C:\\src\\foo.py')).toBe('.py');
			expect(extractExtension('src\\windows\\path.ts')).toBe('.ts');
		});

		it('should handle leading ./ relative paths', () => {
			expect(extractExtension('./relative/foo.js')).toBe('.js');
		});
	});

	describe('query and fragment stripping', () => {
		it('should strip query strings', () => {
			expect(extractExtension('foo.py?ref=main')).toBe('.py');
		});

		it('should strip URL fragments', () => {
			expect(extractExtension('foo.py#L42')).toBe('.py');
		});
	});

	describe('whitespace handling', () => {
		it('should trim leading and trailing whitespace from the input', () => {
			expect(extractExtension('  foo.py  ')).toBe('.py');
		});

		it('should trim trailing whitespace from the basename', () => {
			expect(extractExtension('foo.ts ')).toBe('.ts');
		});
	});

	describe('null returns (pass-through cases)', () => {
		it('should return null for empty string', () => {
			expect(extractExtension('')).toBeNull();
		});

		it('should return null for whitespace-only', () => {
			expect(extractExtension('   ')).toBeNull();
		});

		it('should return null for basename with no dot', () => {
			expect(extractExtension('foo')).toBeNull();
		});

		it('should return null for directory-like paths', () => {
			expect(extractExtension('src/')).toBeNull();
			expect(extractExtension('src')).toBeNull();
		});

		it('should return null for dotfiles with no further dot', () => {
			expect(extractExtension('.gitignore')).toBeNull();
			expect(extractExtension('.env')).toBeNull();
			expect(extractExtension('a/b/.hidden')).toBeNull();
		});

		it('should return null for trailing-dot inputs', () => {
			expect(extractExtension('foo.')).toBeNull();
			expect(extractExtension('..')).toBeNull();
			expect(extractExtension('.')).toBeNull();
		});

		it('should return null for extensions with weird characters (shape check)', () => {
			expect(extractExtension('foo.<>')).toBeNull();
			expect(extractExtension('foo.a/b')).toBeNull();
		});

		it('should return extension for dotfile that has a further dot', () => {
			expect(extractExtension('a/b/.hidden.py')).toBe('.py');
		});

		it('should return null for paths containing an embedded NUL byte', () => {
			// Without this rejection, `foo.py\x00.ts` would extract `.ts` and
			// bypass the guard for an unconfigured `.py` query.
			expect(extractExtension('foo.py\x00.ts')).toBeNull();
			expect(extractExtension('src/foo.py\x00.ts')).toBeNull();
			expect(extractExtension('\x00.ts')).toBeNull();
		});
	});
});

describe('resolveConfiguredExtensions', () => {
	it('should flatten configured language fileExtensions into a lowercase Set', () => {
		const config = new ConstellationConfig(
			'http://localhost:3000',
			'main',
			{
				typescript: { fileExtensions: ['.ts', '.tsx'] },
				javascript: { fileExtensions: ['.js', '.jsx'] },
			},
			'proj:abc',
		);
		const result = resolveConfiguredExtensions(config);
		expect([...result].sort()).toEqual(['.js', '.jsx', '.ts', '.tsx']);
	});

	it('should accept extensions from multiple language entries (e.g., .py alongside .ts)', () => {
		const config = new ConstellationConfig(
			'http://localhost:3000',
			'main',
			{
				typescript: { fileExtensions: ['.ts', '.tsx'] },
				javascript: { fileExtensions: ['.js', '.jsx'] },
				python: { fileExtensions: ['.py'] },
			},
			'proj:multi',
		);
		const result = resolveConfiguredExtensions(config);
		expect(result.has('.py')).toBe(true);
		expect(result.has('.ts')).toBe(true);
		expect(result.has('.jsx')).toBe(true);
		expect([...result].sort()).toEqual(['.js', '.jsx', '.py', '.ts', '.tsx']);
	});

	it('should normalize uppercase extensions to lowercase', () => {
		const config = new ConstellationConfig(
			'u',
			'b',
			{ typescript: { fileExtensions: ['.TS', '.TSX'] } },
			'p',
		);
		const result = resolveConfiguredExtensions(config);
		expect(result.has('.ts')).toBe(true);
		expect(result.has('.tsx')).toBe(true);
	});

	it('should normalize bare extensions by prepending a dot (defensive)', () => {
		const config = new ConstellationConfig(
			'u',
			'b',
			{ typescript: { fileExtensions: ['ts', '.tsx'] } },
			'p',
		);
		const result = resolveConfiguredExtensions(config);
		expect(result.has('.ts')).toBe(true);
		expect(result.has('.tsx')).toBe(true);
	});

	it('should trim whitespace from configured extensions', () => {
		const config = new ConstellationConfig(
			'u',
			'b',
			{ typescript: { fileExtensions: ['  .ts  '] } },
			'p',
		);
		const result = resolveConfiguredExtensions(config);
		expect(result.has('.ts')).toBe(true);
	});

	it('should return an empty Set when languages is empty', () => {
		const config = new ConstellationConfig('u', 'b', {}, 'p');
		const result = resolveConfiguredExtensions(config);
		expect(result.size).toBe(0);
	});

	it('should be a Set instance (callers must treat as readonly)', () => {
		const config = new ConstellationConfig(
			'u',
			'b',
			{ typescript: { fileExtensions: ['.ts'] } },
			'p',
		);
		const result = resolveConfiguredExtensions(config);
		expect(result).toBeInstanceOf(Set);
	});
});
