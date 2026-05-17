/**
 * Usage Tracker Unit Tests
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from '@jest/globals';
import {
	EXECUTOR_NAMES,
	TOKEN_ESTIMATOR_VERSION,
	buildUsageEvent,
	estimateTokens,
	isExecutorName,
	isUsageTrackingEnabled,
	postUsageEvent,
	resolveUsageEndpointUrl,
} from '../../../src/utils/usage-tracker.js';
import { ESTIMATOR_VECTORS } from '../../../src/utils/__fixtures__/estimateTokens-vectors.js';

describe('usage-tracker', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		delete process.env.USAGE_TRACKING_ENABLED;
		delete process.env.USAGE_ENDPOINT_URL;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		jest.restoreAllMocks();
	});

	describe('estimateTokens', () => {
		it.each(ESTIMATOR_VECTORS)(
			'should compute $expected tokens for vector "$label"',
			({ input, expected }) => {
				expect(estimateTokens(input)).toBe(expected);
			},
		);

		it('should never return a negative value', () => {
			expect(estimateTokens('')).toBe(0);
			expect(estimateTokens('a')).toBeGreaterThan(0);
		});
	});

	describe('TOKEN_ESTIMATOR_VERSION', () => {
		it('should match the receiving endpoint literal', () => {
			expect(TOKEN_ESTIMATOR_VERSION).toBe('chars-div-3.5-v1');
		});
	});

	describe('EXECUTOR_NAMES', () => {
		it('should list exactly the 11 canonical executors in camelCase', () => {
			expect(EXECUTOR_NAMES).toEqual([
				'searchSymbols',
				'getSymbolDetails',
				'getDependencies',
				'getDependents',
				'findCircularDependencies',
				'traceSymbolUsage',
				'getCallGraph',
				'findOrphanedCode',
				'impactAnalysis',
				'getArchitectureOverview',
				'ping',
			]);
		});

		it('isExecutorName narrows known names', () => {
			expect(isExecutorName('searchSymbols')).toBe(true);
			expect(isExecutorName('listMethods')).toBe(false);
			expect(isExecutorName('help')).toBe(false);
			expect(isExecutorName('getCapabilities')).toBe(false);
			expect(isExecutorName('unknown')).toBe(false);
		});
	});

	describe('isUsageTrackingEnabled', () => {
		it('should return false when the env var is unset', () => {
			expect(isUsageTrackingEnabled()).toBe(false);
		});

		it('should return false for any value other than literal "true"', () => {
			for (const v of ['1', 'yes', 'TRUE', 'on', '']) {
				process.env.USAGE_TRACKING_ENABLED = v;
				expect(isUsageTrackingEnabled()).toBe(false);
			}
		});

		it('should return true only when set to "true"', () => {
			process.env.USAGE_TRACKING_ENABLED = 'true';
			expect(isUsageTrackingEnabled()).toBe(true);
		});
	});

	describe('resolveUsageEndpointUrl', () => {
		it('should default to <apiUrl>/intel/v1/usage', () => {
			expect(resolveUsageEndpointUrl('http://api.example.com')).toBe(
				'http://api.example.com/intel/v1/usage',
			);
		});

		it('should strip trailing slashes from the base URL', () => {
			expect(resolveUsageEndpointUrl('http://api.example.com/')).toBe(
				'http://api.example.com/intel/v1/usage',
			);
			expect(resolveUsageEndpointUrl('http://api.example.com//')).toBe(
				'http://api.example.com/intel/v1/usage',
			);
		});

		it('should honor USAGE_ENDPOINT_URL override', () => {
			process.env.USAGE_ENDPOINT_URL = 'http://override.local/u';
			expect(resolveUsageEndpointUrl('http://api.example.com')).toBe(
				'http://override.local/u',
			);
		});

		it('should ignore an empty USAGE_ENDPOINT_URL override', () => {
			process.env.USAGE_ENDPOINT_URL = '';
			expect(resolveUsageEndpointUrl('http://api.example.com')).toBe(
				'http://api.example.com/intel/v1/usage',
			);
		});
	});

	describe('buildUsageEvent', () => {
		it('should produce a payload matching the wire format', () => {
			const event = buildUsageEvent({
				projectId: 'proj:0123456789abcdef0123456789abcdef',
				branchName: 'main',
				invocations: ['searchSymbols', 'impactAnalysis'],
				synthesizedResponse: 'x'.repeat(7),
				durationMs: 312.6,
			});

			expect(event).toEqual({
				project_id: 'proj:0123456789abcdef0123456789abcdef',
				branch_name: 'main',
				actual_tokens: 2,
				invocations: ['searchSymbols', 'impactAnalysis'],
				duration_ms: 313,
				estimator_version: 'chars-div-3.5-v1',
			});
		});

		it('should clamp negative durations to zero', () => {
			const event = buildUsageEvent({
				projectId: 'proj:0123456789abcdef0123456789abcdef',
				branchName: 'main',
				invocations: ['ping'],
				synthesizedResponse: '',
				durationMs: -5,
			});
			expect(event.duration_ms).toBe(0);
		});

		it('should copy the invocations array (no shared mutation)', () => {
			const src = ['searchSymbols'];
			const event = buildUsageEvent({
				projectId: 'proj:0123456789abcdef0123456789abcdef',
				branchName: 'main',
				invocations: src,
				synthesizedResponse: 'a',
				durationMs: 0,
			});
			(event.invocations as string[]).push('mutated');
			expect(src).toEqual(['searchSymbols']);
		});
	});

	describe('postUsageEvent', () => {
		const payload = {
			project_id: 'proj:0123456789abcdef0123456789abcdef',
			branch_name: 'main',
			actual_tokens: 42,
			invocations: ['searchSymbols'],
			duration_ms: 10,
			estimator_version: TOKEN_ESTIMATOR_VERSION,
		};

		it('should POST JSON with bearer authorization header', async () => {
			const fetchMock = jest
				.fn<typeof globalThis.fetch>()
				.mockResolvedValue({ ok: true, status: 204 } as Response);
			(globalThis as { fetch: typeof globalThis.fetch }).fetch = fetchMock;

			postUsageEvent({
				endpointUrl: 'http://api/usage',
				accessKey: 'ak:secret',
				payload,
			});

			// Synchronous dispatch; allow promise microtasks to resolve.
			await Promise.resolve();

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const [url, init] = fetchMock.mock.calls[0];
			expect(url).toBe('http://api/usage');
			const headers = (init as RequestInit).headers as Record<string, string>;
			expect(headers.authorization).toBe('Bearer ak:secret');
			expect(headers['content-type']).toBe('application/json');
			expect((init as RequestInit).method).toBe('POST');
			expect(JSON.parse((init as RequestInit).body as string)).toEqual(payload);
		});

		it('should not throw when fetch rejects (failure is swallowed)', async () => {
			const fetchMock = jest
				.fn<typeof globalThis.fetch>()
				.mockRejectedValue(new Error('connection refused'));
			(globalThis as { fetch: typeof globalThis.fetch }).fetch = fetchMock;

			expect(() =>
				postUsageEvent({
					endpointUrl: 'http://api/usage',
					accessKey: 'ak:secret',
					payload,
				}),
			).not.toThrow();

			await Promise.resolve();
			await Promise.resolve();
		});

		it('should not throw when fetch returns a 500 (status ignored)', async () => {
			const fetchMock = jest
				.fn<typeof globalThis.fetch>()
				.mockResolvedValue({ ok: false, status: 500 } as Response);
			(globalThis as { fetch: typeof globalThis.fetch }).fetch = fetchMock;

			expect(() =>
				postUsageEvent({
					endpointUrl: 'http://api/usage',
					accessKey: 'ak:secret',
					payload,
				}),
			).not.toThrow();

			await Promise.resolve();
		});

		it('should noop when global fetch is unavailable', () => {
			const original = globalThis.fetch;
			(globalThis as { fetch?: typeof globalThis.fetch }).fetch =
				undefined as unknown as typeof globalThis.fetch;

			expect(() =>
				postUsageEvent({
					endpointUrl: 'http://api/usage',
					accessKey: 'ak:secret',
					payload,
				}),
			).not.toThrow();

			(globalThis as { fetch: typeof globalThis.fetch }).fetch = original;
		});

		it('should attach an AbortSignal for timeout enforcement', async () => {
			const fetchMock = jest
				.fn<typeof globalThis.fetch>()
				.mockResolvedValue({ ok: true, status: 204 } as Response);
			(globalThis as { fetch: typeof globalThis.fetch }).fetch = fetchMock;

			postUsageEvent({
				endpointUrl: 'http://api/usage',
				accessKey: 'ak:secret',
				payload,
				timeoutMs: 100,
			});

			await Promise.resolve();

			const [, init] = fetchMock.mock.calls[0];
			expect((init as RequestInit).signal).toBeDefined();
		});
	});
});
