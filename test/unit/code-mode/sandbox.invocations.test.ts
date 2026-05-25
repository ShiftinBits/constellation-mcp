/**
 * Sandbox invocations-tracking tests (SB-679).
 *
 * Verifies the per-execution `invocations` buffer captured inside the
 * sandbox executor closure:
 *  - Ordered camelCase entries, repeats preserved
 *  - Utility methods (listMethods, help, getCapabilities) excluded
 *  - Guard-rejected calls (unsupported language) excluded
 */

import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from '@jest/globals';
import { CodeModeSandbox } from '../../../src/code-mode/sandbox.js';
import { ConstellationClient } from '../../../src/client/constellation-client.js';
import { ConstellationConfig } from '../../../src/config/config.js';
import type { ConfigContext } from '../../../src/config/config-cache.js';
import { estimateTokens } from '../../../src/utils/usage-tracker.js';

jest.mock('../../../src/client/constellation-client.js', () => {
	const actual = jest.requireActual<
		typeof import('../../../src/client/constellation-client.js')
	>('../../../src/client/constellation-client.js');
	return {
		...actual,
		ConstellationClient: jest.fn(),
	};
});
jest.mock('../../../src/code-mode/source-enrichment.js', () => ({
	enrichWithSourceSnippets: jest.fn(async (data: unknown) => data),
}));

const MockedClient = ConstellationClient as jest.MockedClass<
	typeof ConstellationClient
>;

function makeConfigContext(): ConfigContext {
	return {
		config: {
			apiUrl: 'http://test-api.com',
			branch: 'main',
			languages: { typescript: { fileExtensions: ['.ts'] } },
			projectId: 'proj:test',
			validate: jest.fn(),
		} as unknown as ConstellationConfig,
		projectId: 'proj:test',
		branchName: 'main',
		apiKey: 'test-key',
		configLoaded: true,
		gitRoot: '/tmp/test',
	};
}

describe('CodeModeSandbox invocations tracking (SB-679)', () => {
	let sandbox: CodeModeSandbox;
	let mockClient: jest.Mocked<ConstellationClient>;

	beforeAll(() => {
		jest.useRealTimers();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	beforeEach(() => {
		mockClient = {
			executeMcpTool: jest.fn(async () => ({
				success: true,
				data: { ok: true },
				metadata: {},
			})),
		} as unknown as jest.Mocked<ConstellationClient>;
		MockedClient.mockImplementation(() => mockClient);

		sandbox = new CodeModeSandbox({
			configContext: makeConfigContext(),
			timeout: 5000,
			allowConsole: false,
			allowTimers: false,
		});
	});

	it('should record api method calls in order with repeats preserved', async () => {
		const result = await sandbox.execute(
			`await api.searchSymbols({ query: 'A' });
			 await api.impactAnalysis({ symbolId: 'x' });
			 await api.searchSymbols({ query: 'B' });
			 await api.getDependents({ filePath: 'src/a.ts' });`,
		);

		expect(result.success).toBe(true);
		expect(result.invocations).toEqual([
			'searchSymbols',
			'impactAnalysis',
			'searchSymbols',
			'getDependents',
		]);
	});

	it('should NOT record utility methods that bypass the executor', async () => {
		const result = await sandbox.execute(
			`api.listMethods();
			 api.help('searchSymbols');
			 await api.searchSymbols({ query: 'X' });`,
		);

		expect(result.success).toBe(true);
		expect(result.invocations).toEqual(['searchSymbols']);
	});

	it('should NOT record calls rejected by the language guard before executor runs', async () => {
		const result = await sandbox.execute(
			`try {
				await api.getDependencies({ filePath: 'README.md' });
			 } catch (e) { /* swallowed */ }
			 await api.searchSymbols({ query: 'OK' });`,
		);

		// getDependencies is rejected by language guard for .md (configured: .ts only)
		expect(result.success).toBe(true);
		expect(mockClient.executeMcpTool).toHaveBeenCalledTimes(1);
		expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
			'search_symbols',
			expect.any(Object),
			expect.any(Object),
			expect.any(Number),
		);
		expect(result.invocations).toEqual(['searchSymbols']);
	});

	it('should return an empty invocations array when the script makes no api calls', async () => {
		const result = await sandbox.execute(`return { hello: 'world' };`);

		expect(result.success).toBe(true);
		expect(result.invocations).toEqual([]);
	});

	it('should start each execute() call with an empty invocations buffer', async () => {
		const first = await sandbox.execute(
			`await api.searchSymbols({ query: 'A' });
			 await api.impactAnalysis({ symbolId: 'x' });`,
		);
		expect(first.invocations).toEqual(['searchSymbols', 'impactAnalysis']);

		const second = await sandbox.execute(`await api.ping();`);
		// Without per-execute reset, this would be ['searchSymbols',
		// 'impactAnalysis', 'ping'] — the test would fail.
		expect(second.invocations).toEqual(['ping']);
	});

	it('should record an invocation even when the underlying API call fails', async () => {
		(mockClient.executeMcpTool as unknown as jest.Mock).mockResolvedValueOnce({
			success: false,
			error: 'boom',
		} as unknown as never);

		const result = await sandbox.execute(
			`try { await api.ping(); } catch (e) {}
			 await api.searchSymbols({ query: 'OK' });`,
		);

		expect(result.success).toBe(true);
		expect(result.invocations).toEqual(['ping', 'searchSymbols']);
	});

	describe('invocationActualTokens', () => {
		it('should return invocationActualTokens with the same length as invocations', async () => {
			const result = await sandbox.execute(
				`await api.searchSymbols({ query: 'A' });
				 await api.impactAnalysis({ symbolId: 'x' });`,
			);

			expect(result.success).toBe(true);
			expect(result.invocationActualTokens).toBeDefined();
			expect(result.invocationActualTokens!.length).toBe(
				result.invocations!.length,
			);
			expect(result.invocationActualTokens!.length).toBe(2);
		});

		it('should record token count from estimateTokens(JSON.stringify(rawResult)) for each call', async () => {
			const knownData = { symbols: [{ id: 'abc', name: 'Foo' }] };
			(mockClient.executeMcpTool as unknown as jest.Mock).mockResolvedValueOnce(
				{
					success: true,
					data: knownData,
					metadata: {},
				} as unknown as never,
			);

			const result = await sandbox.execute(
				`await api.searchSymbols({ query: 'Foo' });`,
			);

			expect(result.success).toBe(true);
			expect(result.invocationActualTokens).toBeDefined();
			// Use the same estimator the sandbox uses, so a formula change in
			// usage-tracker won't silently drift this assertion.
			const expectedTokens = estimateTokens(JSON.stringify(knownData));
			expect(result.invocationActualTokens![0]).toBe(expectedTokens);
		});

		it('should truncate invocationActualTokens to 200 in lockstep with invocations when 250 calls are made', async () => {
			MockedClient.mockImplementationOnce(
				() =>
					({
						executeMcpTool: jest.fn(async () => ({
							success: true,
							data: { ok: true },
							metadata: {},
						})),
					}) as unknown as jest.Mocked<ConstellationClient>,
			);
			const sandboxWith250 = new CodeModeSandbox({
				configContext: makeConfigContext(),
				maxApiCalls: 250,
			});

			const manyCallsCode = `
				for (let i = 0; i < 250; i++) {
					await api.searchSymbols({ query: 'x' });
				}
			`;

			const result = await sandboxWith250.execute(manyCallsCode, {
				timeoutMs: 30000,
			});

			expect(result.invocations).toBeDefined();
			expect(result.invocationActualTokens).toBeDefined();
			expect(result.invocations!.length).toBe(200);
			expect(result.invocationActualTokens!.length).toBe(200);
		});

		it('should record 0 tokens for a failed api call and keep arrays length-equal', async () => {
			(mockClient.executeMcpTool as unknown as jest.Mock).mockResolvedValueOnce(
				{
					success: false,
					error: 'boom',
				} as unknown as never,
			);

			const result = await sandbox.execute(
				`try { await api.ping(); } catch (e) {}
				 await api.searchSymbols({ query: 'OK' });`,
			);

			expect(result.success).toBe(true);
			expect(result.invocations!.length).toBe(
				result.invocationActualTokens!.length,
			);
			expect(result.invocationActualTokens![0]).toBe(0);
			expect(result.invocationActualTokens![1]).toBeGreaterThan(0);
		});

		it('should return an empty invocationActualTokens array when no api calls are made', async () => {
			const result = await sandbox.execute(`return { hello: 'world' };`);

			expect(result.success).toBe(true);
			expect(result.invocationActualTokens).toEqual([]);
		});

		it('should keep arrays aligned when executeMcpTool itself throws (raw exception)', async () => {
			// Mid-call throw — not an API-level { success: false } response.
			// This exercises the outer catch path that's separate from the
			// !result.success path.
			mockClient.executeMcpTool.mockRejectedValueOnce(
				new Error('network exploded') as unknown as never,
			);

			const result = await sandbox.execute(
				`try { await api.ping(); } catch (e) {}
				 await api.searchSymbols({ query: 'OK' });`,
			);

			expect(result.success).toBe(true);
			expect(result.invocations!.length).toBe(
				result.invocationActualTokens!.length,
			);
			expect(result.invocations).toEqual(['ping', 'searchSymbols']);
			expect(result.invocationActualTokens![0]).toBe(0);
			expect(result.invocationActualTokens![1]).toBeGreaterThan(0);
		});
	});
});
