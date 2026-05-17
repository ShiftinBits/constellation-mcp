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
});
