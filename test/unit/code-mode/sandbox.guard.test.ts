import { describe, it, expect, jest } from '@jest/globals';
import {
	withFilePathLanguageGuard,
	GUARDED_METHODS,
} from '../../../src/code-mode/language-registry.js';
import { UnsupportedLanguageError } from '../../../src/client/constellation-client.js';

const GUARDED = [
	'getDependencies',
	'getDependents',
	'getCallGraph',
	'traceSymbolUsage',
	'impactAnalysis',
] as const;

describe('GUARDED_METHODS', () => {
	it('should contain exactly the methods whose filePath is a routing key', () => {
		expect([...GUARDED_METHODS].sort()).toEqual([...GUARDED].sort());
	});

	it('should NOT include getSymbolDetails (filePath is an optional filter; symbolId can route)', () => {
		expect(GUARDED_METHODS.has('getSymbolDetails')).toBe(false);
	});

	it('should NOT include findCircularDependencies (filePath is an optional filter on a project-wide scan)', () => {
		expect(GUARDED_METHODS.has('findCircularDependencies')).toBe(false);
	});
});

describe('withFilePathLanguageGuard', () => {
	const tsOnly: ReadonlySet<string> = new Set(['.ts', '.tsx']);

	it('should pass through when params.filePath has a configured extension', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		const result = await guarded({ filePath: 'src/foo.ts' });

		expect(result).toEqual({ ok: true });
		expect(inner).toHaveBeenCalledTimes(1);
		expect(inner).toHaveBeenCalledWith({ filePath: 'src/foo.ts' });
	});

	it('should throw UnsupportedLanguageError BEFORE invoking inner when extension is not configured', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		await expect(guarded({ filePath: 'src/foo.py' })).rejects.toThrow(
			UnsupportedLanguageError,
		);
		expect(inner).not.toHaveBeenCalled();
	});

	it('should populate the thrown error with the rejected filePath, extension, and configured set', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({});
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		await expect(guarded({ filePath: 'lib/foo.py' })).rejects.toMatchObject({
			filePath: 'lib/foo.py',
			extension: '.py',
			configuredExtensions: ['.ts', '.tsx'],
		});
	});

	it('should pass through when params has no filePath property', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		const result = await guarded({ symbolId: 'x' });

		expect(result).toEqual({ ok: true });
		expect(inner).toHaveBeenCalledTimes(1);
	});

	it('should pass through when params.filePath is undefined (optional-filePath methods)', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		const result = await guarded({ filePath: undefined });

		expect(result).toEqual({ ok: true });
		expect(inner).toHaveBeenCalledTimes(1);
	});

	it('should pass through when params.filePath is empty string', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		await guarded({ filePath: '' });

		expect(inner).toHaveBeenCalledTimes(1);
	});

	it('should pass through when extractExtension returns null (extensionless filePath)', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		await guarded({ filePath: 'src/index' });

		expect(inner).toHaveBeenCalledTimes(1);
	});

	it('should pass through everything when configuredExtensions is empty (unconfigured project)', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const empty: ReadonlySet<string> = new Set();
		const guarded = withFilePathLanguageGuard(inner, empty);

		await guarded({ filePath: 'foo.py' });
		await guarded({ filePath: 'bar.go' });
		await guarded({ filePath: 'baz.rs' });

		expect(inner).toHaveBeenCalledTimes(3);
	});

	it('should pass through when params.filePath is a non-string primitive (number)', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		await guarded({ filePath: 42 } as unknown as Record<string, unknown>);

		expect(inner).toHaveBeenCalledTimes(1);
	});

	it('should pass through when params.filePath is an object with a stringifying toString (no implicit coercion)', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		await guarded({
			filePath: { toString: () => 'foo.py' },
		} as unknown as Record<string, unknown>);

		expect(inner).toHaveBeenCalledTimes(1);
	});

	it('should pass through when params is null/undefined (defensive)', async () => {
		const inner = jest
			.fn<(p: unknown) => Promise<unknown>>()
			.mockResolvedValue({ ok: true });
		const guarded = withFilePathLanguageGuard(inner, tsOnly);

		await guarded(undefined as unknown as Record<string, unknown>);
		await guarded(null as unknown as Record<string, unknown>);

		expect(inner).toHaveBeenCalledTimes(2);
	});
});
