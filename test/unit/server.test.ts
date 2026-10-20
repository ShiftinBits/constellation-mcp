/**
 * Protocol-level tests for buildServer(), driven over an in-memory transport
 * with raw JSON-RPC so the assertions see exactly what a client receives.
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
	InMemoryTransport,
	type JSONRPCMessage,
} from '@modelcontextprotocol/server';
import {
	serveStdio,
	type StdioServerHandle,
} from '@modelcontextprotocol/server/stdio';
import { CodeModeRuntime } from '../../src/code-mode/runtime.js';
import {
	configCache,
	type ConfigContext,
} from '../../src/config/config-cache.js';
import type { ConstellationConfig } from '../../src/config/config.js';
import { buildServer } from '../../src/server.js';
import { METHOD_SUMMARIES } from '../../src/types/method-summaries.js';

// Mock worker-path to avoid import.meta.url (not supported in ts-jest CJS mode)
jest.mock('../../src/code-mode/worker-path.js', () => ({
	WORKER_PATH: '/mocked/path/sandbox-worker.js',
}));

interface RpcResponse {
	id: number;
	result?: Record<string, unknown>;
	error?: { code: number; message: string; data?: { uri?: string } };
}

const SERVER_OPTIONS = { version: '0.0.0-test' };

const MODERN_META = {
	'io.modelcontextprotocol/protocolVersion': '2026-07-28',
	'io.modelcontextprotocol/clientInfo': { name: 'server-test', version: '0' },
	'io.modelcontextprotocol/clientCapabilities': {},
};

/** Minimal raw JSON-RPC client over the client half of a linked pair. */
function createClient(transport: InMemoryTransport) {
	const pending = new Map<number, (r: RpcResponse) => void>();
	let nextId = 1;
	transport.onmessage = (message: JSONRPCMessage) => {
		const response = message as unknown as RpcResponse;
		pending.get(response.id)?.(response);
		pending.delete(response.id);
	};
	return {
		request(method: string, params: Record<string, unknown> = {}) {
			const id = nextId++;
			return new Promise<RpcResponse>((resolve) => {
				pending.set(id, resolve);
				void transport.send({ jsonrpc: '2.0', id, method, params });
			});
		},
		notify(method: string) {
			return transport.send({ jsonrpc: '2.0', method });
		},
	};
}

const names = (items: unknown, key: string) =>
	(items as Record<string, string>[]).map((item) => item[key]);

interface AdvertisedTool {
	inputSchema: { properties: Record<string, unknown>; required?: string[] };
	outputSchema: { type?: string; anyOf?: unknown[] };
}

/** The single advertised tool from a tools/list response. */
const codeIntelTool = (res: RpcResponse) =>
	(res.result?.tools as AdvertisedTool[])[0];

/** A hook-mode call that is quiet before any config or network access. */
const QUIET_HOOK_CALL = {
	name: 'code_intel',
	arguments: {
		code: 'return null',
		cwd: '/not/a/project',
		hook: { event: 'NotAHookEvent', input: {} },
	},
};

/** Hook calls with a malformed field; the unindexed cwd keeps them quiet. */
const MALFORMED_HOOK_CALLS: Array<[string, Record<string, unknown>]> = [
	['sessionId', { event: 'PostToolUse', input: {}, sessionId: 5 }],
	['settings', { event: 'PostToolUse', input: {}, settings: 'x' }],
];

const malformedHookCall = (hook: Record<string, unknown>) => ({
	...QUIET_HOOK_CALL,
	arguments: { ...QUIET_HOOK_CALL.arguments, hook },
});

const HOOK_OUTPUT = {
	hookSpecificOutput: {
		hookEventName: 'PostToolUse',
		additionalContext: '3 dependents',
	},
	systemMessage: 'Impact checked',
};

/**
 * Stub config resolution and execution so a hook call yields
 * {@link HOOK_OUTPUT} with no filesystem or network access. Returns a
 * function that restores both.
 */
function stubHookExecution(): () => void {
	const configContext = {
		config: { apiUrl: 'https://api.constellation.test' } as ConstellationConfig,
		projectId: 'test-project',
		branchName: 'test-branch',
		apiKey: 'test-key',
		configLoaded: true,
		gitRoot: '/test/project',
	} as ConfigContext;
	const spies = [
		jest
			.spyOn(configCache, 'getConfigForPath')
			.mockResolvedValue(configContext),
		jest.spyOn(CodeModeRuntime.prototype, 'execute').mockResolvedValue({
			success: true,
			result: { context: '3 dependents', message: 'Impact checked' },
		}),
	];
	return () => spies.forEach((spy) => spy.mockRestore());
}

const HOOK_CALL = {
	name: 'code_intel',
	arguments: {
		code: 'return null',
		cwd: '/test/project',
		hook: { event: 'PostToolUse', input: {} },
	},
};

describe('buildServer', () => {
	describe('legacy era (initialize)', () => {
		let transport: InMemoryTransport;
		let client: ReturnType<typeof createClient>;

		beforeEach(async () => {
			const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
			transport = clientSide;
			client = createClient(clientSide);
			await clientSide.start();
			await buildServer(SERVER_OPTIONS).connect(serverSide);

			const init = await client.request('initialize', {
				protocolVersion: '2025-11-25',
				capabilities: {},
				clientInfo: { name: 'server-test', version: '0.0.0' },
			});
			expect(init.error).toBeUndefined();
			await client.notify('notifications/initialized');
		});

		afterEach(async () => {
			await transport.close();
		});

		it('should list only the code_intel tool on tools/list', async () => {
			const res = await client.request('tools/list');
			expect(names(res.result?.tools, 'name')).toEqual(['code_intel']);
		});

		it('should advertise tool schemas without a $schema dialect', async () => {
			const res = await client.request('tools/list');
			const [tool] = res.result?.tools as Record<string, object>[];
			expect(tool.inputSchema).not.toHaveProperty('$schema');
			expect(tool.outputSchema).not.toHaveProperty('$schema');
		});

		it('should advertise the output union with an object root', async () => {
			const res = await client.request('tools/list');
			const { outputSchema } = codeIntelTool(res);
			expect(outputSchema.type).toBe('object');
			expect(outputSchema.anyOf).toHaveLength(2);
			expect(outputSchema).not.toHaveProperty('$schema');
		});

		it('should expose the optional hook input', async () => {
			const res = await client.request('tools/list');
			const { inputSchema } = codeIntelTool(res);
			expect(inputSchema.properties).toHaveProperty('hook');
			expect(inputSchema.required).not.toContain('hook');
		});

		it('should return an unwrapped empty hook output without isError', async () => {
			const res = await client.request('tools/call', QUIET_HOOK_CALL);
			expect(res.error).toBeUndefined();
			expect(res.result?.structuredContent).toEqual({});
			expect(res.result?.isError).toBeFalsy();
			expect(res.result?.content).toEqual([{ type: 'text', text: '{}' }]);
		});

		it('should accept a hook call that omits input', async () => {
			const { hook } = QUIET_HOOK_CALL.arguments;
			const res = await client.request('tools/call', {
				...QUIET_HOOK_CALL,
				arguments: {
					...QUIET_HOOK_CALL.arguments,
					hook: { event: hook.event },
				},
			});
			expect(res.result?.structuredContent).toEqual({});
			expect(res.result?.isError).toBeFalsy();
		});

		it.each(MALFORMED_HOOK_CALLS)(
			'should return a quiet hook output for a malformed %s',
			async (_field, hook) => {
				const res = await client.request('tools/call', malformedHookCall(hook));
				expect(res.error).toBeUndefined();
				expect(res.result?.structuredContent).toEqual({});
				expect(res.result?.isError).toBeFalsy();
			},
		);

		it('should return a non-empty hook output unwrapped in structuredContent', async () => {
			const restore = stubHookExecution();
			try {
				const res = await client.request('tools/call', HOOK_CALL);
				expect(res.error).toBeUndefined();
				expect(res.result?.structuredContent).toEqual(HOOK_OUTPUT);
				expect(res.result?.isError).toBeFalsy();
				const [item] = res.result?.content as { text: string }[];
				expect(item.text).toBe(JSON.stringify(res.result?.structuredContent));
			} finally {
				restore();
			}
		});

		it('should list the static resources and both resource templates', async () => {
			const [resources, templates] = await Promise.all([
				client.request('resources/list'),
				client.request('resources/templates/list'),
			]);
			expect(names(resources.result?.resources, 'uri')).toEqual(
				expect.arrayContaining([
					'constellation://types/api',
					'constellation://docs/guide',
					'constellation://metrics',
				]),
			);
			expect(names(templates.result?.resourceTemplates, 'uriTemplate')).toEqual(
				expect.arrayContaining([
					'constellation://types/api/{methodName}',
					'constellation://docs/guide/{section}',
				]),
			);
		});

		it.each([
			'constellation://types/api',
			'constellation://types/api/searchSymbols',
			'constellation://docs/guide/methods',
		])('should read %s', async (uri) => {
			const res = await client.request('resources/read', { uri });
			expect(res.error).toBeUndefined();
			const [content] = res.result?.contents as { uri: string; text: string }[];
			expect(content.uri).toBe(uri);
			expect(content.text.length).toBeGreaterThan(0);
		});

		it('should serve every method summary at constellation://types/api', async () => {
			const res = await client.request('resources/read', {
				uri: 'constellation://types/api',
			});
			const [{ text }] = res.result?.contents as { text: string }[];
			for (const summary of Object.values(METHOD_SUMMARIES)) {
				expect(text).toContain(summary);
			}
		});

		it('should state the size of constellation://types/api in its description', async () => {
			const [list, read] = await Promise.all([
				client.request('resources/list'),
				client.request('resources/read', { uri: 'constellation://types/api' }),
			]);
			const resource = (
				list.result?.resources as { uri: string; description: string }[]
			).find((r) => r.uri === 'constellation://types/api');
			const [{ text }] = read.result?.contents as { text: string }[];
			expect(resource?.description).toContain(
				`~${Math.round(Buffer.byteLength(text) / 1024)}KB`,
			);
		});

		it.each([
			'constellation://types/api/notAMethod',
			'constellation://docs/guide/nope',
		])(
			'should reject %s with -32602 and data.uri when the variable is unknown',
			async (uri) => {
				const res = await client.request('resources/read', { uri });
				expect(res.result).toBeUndefined();
				expect(res.error?.code).toBe(-32602);
				expect(res.error?.data?.uri).toBe(uri);
				expect(res.error?.message).toContain('Available:');
			},
		);
	});

	describe('2026-07-28 era (serveStdio)', () => {
		let handle: StdioServerHandle;
		let client: ReturnType<typeof createClient>;

		const modernRequest = (method: string, params = {}) =>
			client.request(method, { ...params, _meta: MODERN_META });

		beforeEach(async () => {
			const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
			client = createClient(clientSide);
			await clientSide.start();
			handle = serveStdio(() => buildServer(SERVER_OPTIONS), {
				transport: serverSide,
			});
		});

		afterEach(async () => {
			await handle.close();
		});

		it('should advertise 2026-07-28 and instructions on server/discover', async () => {
			const res = await modernRequest('server/discover');
			expect(res.result?.supportedVersions).toContain('2026-07-28');
			expect(typeof res.result?.instructions).toBe('string');
		});

		it.each([
			['server/discover', {}],
			['tools/list', {}],
			['resources/list', {}],
			['resources/templates/list', {}],
			['resources/read', { uri: 'constellation://types/api' }],
			['resources/read', { uri: 'constellation://types/api/searchSymbols' }],
			['resources/read', { uri: 'constellation://docs/guide' }],
			['resources/read', { uri: 'constellation://docs/guide/methods' }],
		])('should mark %s %j as public for one hour', async (method, params) => {
			const res = await modernRequest(method, params);
			expect(res.result).toMatchObject({
				ttlMs: 3_600_000,
				cacheScope: 'public',
			});
		});

		it('should advertise the output union with an object root', async () => {
			const res = await modernRequest('tools/list');
			const { outputSchema } = codeIntelTool(res);
			expect(outputSchema.type).toBe('object');
			expect(outputSchema.anyOf).toHaveLength(2);
			expect(outputSchema).not.toHaveProperty('$schema');
		});

		it('should expose the optional hook input', async () => {
			const res = await modernRequest('tools/list');
			const { inputSchema } = codeIntelTool(res);
			expect(inputSchema.properties).toHaveProperty('hook');
			expect(inputSchema.required).not.toContain('hook');
		});

		it('should return an empty hook output without isError', async () => {
			const res = await modernRequest('tools/call', QUIET_HOOK_CALL);
			expect(res.error).toBeUndefined();
			expect(res.result?.structuredContent).toEqual({});
			expect(res.result?.isError).toBeFalsy();
			expect(res.result?.content).toEqual([{ type: 'text', text: '{}' }]);
		});

		it('should accept a hook call that omits input', async () => {
			const { hook } = QUIET_HOOK_CALL.arguments;
			const res = await modernRequest('tools/call', {
				...QUIET_HOOK_CALL,
				arguments: {
					...QUIET_HOOK_CALL.arguments,
					hook: { event: hook.event },
				},
			});
			expect(res.error).toBeUndefined();
			expect(res.result?.structuredContent).toEqual({});
			expect(res.result?.isError).toBeFalsy();
		});

		it.each(MALFORMED_HOOK_CALLS)(
			'should return a quiet hook output for a malformed %s',
			async (_field, hook) => {
				const res = await modernRequest('tools/call', malformedHookCall(hook));
				expect(res.error).toBeUndefined();
				expect(res.result?.structuredContent).toEqual({});
				expect(res.result?.isError).toBeFalsy();
			},
		);

		it('should return a non-empty hook output unwrapped in structuredContent', async () => {
			const restore = stubHookExecution();
			try {
				const res = await modernRequest('tools/call', HOOK_CALL);
				expect(res.error).toBeUndefined();
				expect(res.result?.structuredContent).toEqual(HOOK_OUTPUT);
				expect(res.result?.isError).toBeFalsy();
				const [item] = res.result?.content as { text: string }[];
				expect(item.text).toBe(JSON.stringify(res.result?.structuredContent));
			} finally {
				restore();
			}
		});

		it('should mark the metrics snapshot as private and uncached', async () => {
			const res = await modernRequest('resources/read', {
				uri: 'constellation://metrics',
			});
			expect(res.result).toMatchObject({ ttlMs: 0, cacheScope: 'private' });
		});

		it.each([
			'constellation://types/api/notAMethod',
			'constellation://docs/guide/nope',
		])('should reject %s with -32602 and data.uri', async (uri) => {
			const res = await modernRequest('resources/read', { uri });
			expect(res.error?.code).toBe(-32602);
			expect(res.error?.data?.uri).toBe(uri);
		});
	});
});
