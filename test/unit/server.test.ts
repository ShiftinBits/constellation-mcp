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
import { buildServer } from '../../src/server.js';

// Mock worker-path to avoid import.meta.url (not supported in ts-jest CJS mode)
jest.mock('../../src/code-mode/worker-path.js', () => ({
	WORKER_PATH: '/mocked/path/sandbox-worker.js',
}));

type Response = {
	id: number;
	result?: Record<string, any>;
	error?: { code: number; message: string; data?: { uri?: string } };
};

describe('buildServer', () => {
	let client: InMemoryTransport;
	let pending: Map<number, (r: Response) => void>;
	let nextId: number;

	const request = (method: string, params: Record<string, unknown> = {}) => {
		const id = nextId++;
		return new Promise<Response>((resolve) => {
			pending.set(id, resolve);
			void client.send({ jsonrpc: '2.0', id, method, params });
		});
	};

	beforeEach(async () => {
		pending = new Map();
		nextId = 1;
		const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
		client = clientSide;
		client.onmessage = (message: JSONRPCMessage) => {
			const response = message as unknown as Response;
			pending.get(response.id)?.(response);
		};
		await client.start();

		const server = buildServer({
			version: '0.0.0-test',
			apiTypesPath: '/nonexistent/api-types.d.ts',
		});
		await server.connect(serverSide);

		const init = await request('initialize', {
			protocolVersion: '2025-11-25',
			capabilities: {},
			clientInfo: { name: 'server-test', version: '0.0.0' },
		});
		expect(init.error).toBeUndefined();
		await client.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
	});

	afterEach(async () => {
		await client.close();
	});

	it('should list only the code_intel tool on tools/list', async () => {
		const res = await request('tools/list');
		expect(res.result?.tools.map((t: { name: string }) => t.name)).toEqual([
			'code_intel',
		]);
	});

	it('should list the static resources and both resource templates', async () => {
		const [resources, templates] = await Promise.all([
			request('resources/list'),
			request('resources/templates/list'),
		]);
		const uris = resources.result?.resources.map((r: { uri: string }) => r.uri);
		expect(uris).toEqual(
			expect.arrayContaining([
				'constellation://types/api',
				'constellation://docs/guide',
				'constellation://metrics',
			]),
		);
		expect(
			templates.result?.resourceTemplates.map(
				(t: { uriTemplate: string }) => t.uriTemplate,
			),
		).toEqual(
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
		const res = await request('resources/read', { uri });
		expect(res.error).toBeUndefined();
		expect(res.result?.contents[0].uri).toBe(uri);
		expect(res.result?.contents[0].text.length).toBeGreaterThan(0);
	});

	it.each([
		'constellation://types/api/notAMethod',
		'constellation://docs/guide/nope',
	])(
		'should reject %s with -32602 and data.uri when the variable is unknown',
		async (uri) => {
			const res = await request('resources/read', { uri });
			expect(res.result).toBeUndefined();
			expect(res.error?.code).toBe(-32602);
			expect(res.error?.data?.uri).toBe(uri);
			expect(res.error?.message).toContain('Available:');
		},
	);
});
