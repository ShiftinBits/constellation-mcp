/**
 * Query Code Graph Tool — usage telemetry wiring
 *
 * Verifies the tool handler's fire-and-forget POST to /intel/v1/usage:
 *  - Emits exactly one POST per successful code_intel call when telemetry
 *    is enabled (the default — see CONSTELLATION_USAGE_METRICS)
 *  - Emits zero POSTs when telemetry is explicitly disabled
 *  - Emits zero POSTs when the script ran no api methods
 *  - Emits zero POSTs on error paths (structured error, validation failure)
 *  - POST failure (500 / network error) does not propagate to the response
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from '@jest/globals';
import { CodeModeRuntime } from '../../../src/code-mode/runtime.js';
import type { ConfigContext } from '../../../src/config/config-cache.js';
import { ConstellationConfig } from '../../../src/config/config.js';
import { registerQueryCodeGraphTool } from '../../../src/tools/query-code-graph-tool.js';

jest.mock('../../../src/code-mode/worker-path.js', () => ({
	WORKER_PATH: '/mocked/path/sandbox-worker.js',
}));

const mockConfigContext: ConfigContext = {
	config: {
		apiUrl: 'https://api.constellationdev.io',
		branch: 'test-branch',
		languages: { typescript: { fileExtensions: ['.ts'] } },
		projectId: 'proj:0123456789abcdef0123456789abcdef',
		validate: jest.fn(),
	} as unknown as ConstellationConfig,
	projectId: 'proj:0123456789abcdef0123456789abcdef',
	branchName: 'test-branch',
	apiKey: 'test-key',
	configLoaded: true,
	gitRoot: '/test/project',
};

jest.mock('../../../src/code-mode/runtime.js');
jest.mock('../../../src/config/config-cache.js', () => ({
	configCache: {
		getConfigForPath: jest.fn(async () => mockConfigContext),
		getDefaultConfig: jest.fn(() => mockConfigContext),
		hasDefaultConfig: jest.fn(() => true),
	},
	ConfigCacheError: class ConfigCacheError extends Error {
		constructor(
			message: string,
			public readonly code: string,
			public readonly guidance: string[],
		) {
			super(message);
			this.name = 'ConfigCacheError';
		}
	},
}));

const MockedRuntime = CodeModeRuntime as jest.MockedClass<
	typeof CodeModeRuntime
>;

describe('code_intel — usage telemetry wiring', () => {
	let mockServer: any;
	let registeredHandler: any;
	let mockRuntime: any;
	let fetchMock: any;
	const originalEnv = { ...process.env };

	beforeEach(() => {
		jest.clearAllMocks();
		delete process.env.CONSTELLATION_USAGE_METRICS;
		delete process.env.USAGE_TRACKING_ENABLED;
		delete process.env.USAGE_ENDPOINT_URL;

		mockRuntime = {
			execute: jest.fn(),
			formatResult: jest.fn(() => '{"success":true,"result":{"ok":1}}'),
		};
		MockedRuntime.mockImplementation(() => mockRuntime as any);

		mockServer = {
			registerTool: jest.fn((_n: unknown, _c: unknown, h: unknown) => {
				registeredHandler = h;
			}),
		};
		registerQueryCodeGraphTool(mockServer);

		fetchMock = jest.fn(async () => ({ ok: true, status: 204 }));
		(globalThis as any).fetch = fetchMock;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	const flushMicrotasks = () => new Promise((r) => setImmediate(r));

	it('should NOT post when CONSTELLATION_USAGE_METRICS=false (explicit opt-out)', async () => {
		process.env.CONSTELLATION_USAGE_METRICS = 'false';
		mockRuntime.execute.mockResolvedValue({
			success: true,
			result: {},
			executionTime: 50,
			invocations: ['searchSymbols'],
		} as never);

		await registeredHandler({ code: 'x', cwd: '/test/project' });
		await flushMicrotasks();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should NOT post when CONSTELLATION_USAGE_METRICS=0', async () => {
		process.env.CONSTELLATION_USAGE_METRICS = '0';
		mockRuntime.execute.mockResolvedValue({
			success: true,
			result: {},
			executionTime: 50,
			invocations: ['searchSymbols'],
		} as never);

		await registeredHandler({ code: 'x', cwd: '/test/project' });
		await flushMicrotasks();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should NOT post when legacy USAGE_TRACKING_ENABLED=false and new flag is unset', async () => {
		// Transitional guard: operators who explicitly opted out under the
		// old contract must stay disabled until they migrate to the new
		// flag. Without this branch they would be silently flipped on.
		process.env.USAGE_TRACKING_ENABLED = 'false';
		mockRuntime.execute.mockResolvedValue({
			success: true,
			result: {},
			executionTime: 50,
			invocations: ['searchSymbols'],
		} as never);

		await registeredHandler({ code: 'x', cwd: '/test/project' });
		await flushMicrotasks();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should POST exactly one event per successful call when telemetry is enabled (default)', async () => {
		// beforeEach deleted CONSTELLATION_USAGE_METRICS and the legacy
		// USAGE_TRACKING_ENABLED; this test deliberately leaves both unset
		// to exercise the default-on (opt-out) path.
		mockRuntime.execute.mockResolvedValue({
			success: true,
			result: { ok: 1 },
			executionTime: 50,
			invocations: ['searchSymbols', 'impactAnalysis'],
		} as never);

		const result = (await registeredHandler({
			code: 'x',
			cwd: '/test/project',
		})) as { structuredContent: { success: boolean } };

		await flushMicrotasks();

		expect(result.structuredContent.success).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.constellationdev.io/intel/v1/usage');
		const body = JSON.parse((init as RequestInit).body as string);
		expect(body).toMatchObject({
			project_id: 'proj:0123456789abcdef0123456789abcdef',
			branch_name: 'test-branch',
			invocations: ['searchSymbols', 'impactAnalysis'],
			duration_ms: 50,
			estimator_version: 'chars-div-3.5-v1',
		});
		expect(body.actual_tokens).toBeGreaterThan(0);
		expect((init as RequestInit).method).toBe('POST');
		expect(
			((init as RequestInit).headers as Record<string, string>).authorization,
		).toBe('Bearer test-key');
	});

	it('should NOT post when the script ran no api methods', async () => {
		mockRuntime.execute.mockResolvedValue({
			success: true,
			result: { ok: 1 },
			executionTime: 5,
			invocations: [],
		} as never);

		await registeredHandler({ code: 'x', cwd: '/test/project' });
		await flushMicrotasks();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should NOT post when success is false even without a structuredError', async () => {
		// A degraded code-path that returns { success: false } without a
		// structuredError must NOT fire telemetry. The contract is
		// "successful run only" — invocations may be non-empty from
		// calls that ran before the failure, so the gate has to
		// branch on `response.success`, not just structuredError absence.
		mockRuntime.execute.mockResolvedValue({
			success: false,
			error: 'executor returned a soft failure',
			executionTime: 12,
			invocations: ['searchSymbols'],
		} as never);

		await registeredHandler({ code: 'x', cwd: '/test/project' });
		await flushMicrotasks();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should NOT post when execution returns a structured error', async () => {
		mockRuntime.execute.mockResolvedValue({
			success: false,
			executionTime: 10,
			structuredError: {
				error: {
					code: 'EXECUTION_ERROR',
					type: 'execution',
					message: 'boom',
					recoverable: false,
					guidance: [],
				},
			},
		} as never);

		await registeredHandler({ code: 'x', cwd: '/test/project' });
		await flushMicrotasks();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('should swallow POST 500 — response to LLM is unaffected', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
		mockRuntime.execute.mockResolvedValue({
			success: true,
			result: { ok: 1 },
			executionTime: 50,
			invocations: ['searchSymbols'],
		} as never);

		const result = (await registeredHandler({
			code: 'x',
			cwd: '/test/project',
		})) as { structuredContent: { success: boolean } };

		await flushMicrotasks();

		expect(result.structuredContent.success).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('should swallow POST network rejection — response to LLM is unaffected', async () => {
		fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
		mockRuntime.execute.mockResolvedValue({
			success: true,
			result: { ok: 1 },
			executionTime: 50,
			invocations: ['searchSymbols'],
		} as never);

		const result = (await registeredHandler({
			code: 'x',
			cwd: '/test/project',
		})) as { structuredContent: { success: boolean } };

		await flushMicrotasks();

		expect(result.structuredContent.success).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('should honor USAGE_ENDPOINT_URL override', async () => {
		process.env.USAGE_ENDPOINT_URL = 'http://override.local/u';
		mockRuntime.execute.mockResolvedValue({
			success: true,
			result: { ok: 1 },
			executionTime: 50,
			invocations: ['ping'],
		} as never);

		await registeredHandler({ code: 'x', cwd: '/test/project' });
		await flushMicrotasks();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe('http://override.local/u');
	});
});
