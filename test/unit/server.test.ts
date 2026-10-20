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
import { buildServer } from '../../src/server.js';

// Mock worker-path to avoid import.meta.url (not supported in ts-jest CJS mode)
jest.mock('../../src/code-mode/worker-path.js', () => ({
	WORKER_PATH: '/mocked/path/sandbox-worker.js',
}));

interface RpcResponse {
	id: number;
	result?: Record<string, unknown>;
	error?: { code: number; message: string; data?: { uri?: string } };
}

const SERVER_OPTIONS = {
	version: '0.0.0-test',
	apiTypesPath: '/nonexistent/api-types.d.ts',
};

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
			'constellation://types/api/searchSymbols',
			'constellation://docs/guide/methods',
		])('should read %s when the template variable is known', async (uri) => {
			const res = await client.request('resources/read', { uri });
			expect(res.error).toBeUndefined();
			const [content] = res.result?.contents as { uri: string; text: string }[];
			expect(content.uri).toBe(uri);
			expect(content.text.length).toBeGreaterThan(0);
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
			['resources/read', { uri: 'constellation://docs/guide' }],
			['resources/read', { uri: 'constellation://types/api/searchSymbols' }],
		])('should mark %s %j as public for one hour', async (method, params) => {
			const res = await modernRequest(method, params);
			expect(res.result).toMatchObject({
				ttlMs: 3_600_000,
				cacheScope: 'public',
			});
		});

		it('should mark the metrics snapshot as private and uncached', async () => {
			const res = await modernRequest('resources/read', {
				uri: 'constellation://metrics',
			});
			expect(res.result).toMatchObject({ ttlMs: 0, cacheScope: 'private' });
		});

		it('should reject an unknown guide section with -32602 and data.uri', async () => {
			const uri = 'constellation://docs/guide/nope';
			const res = await modernRequest('resources/read', { uri });
			expect(res.error?.code).toBe(-32602);
			expect(res.error?.data?.uri).toBe(uri);
		});
	});
});
