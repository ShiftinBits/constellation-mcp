/**
 * Query Code Graph Tool golden output
 *
 * Pins the exact handler output (text item, structuredContent, isError) for a
 * fixed runtime response, so any change to the normal (agent-facing) path is
 * caught byte for byte. The runtime's `execute` is mocked; `formatResult` is
 * the real implementation so the text item reflects production formatting.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CodeModeRuntime } from '../../../src/code-mode/runtime.js';
import type { CodeModeResponse } from '../../../src/code-mode/runtime.js';
import { registerQueryCodeGraphTool } from '../../../src/tools/query-code-graph-tool.js';

jest.mock('../../../src/code-mode/worker-path.js', () => ({
	WORKER_PATH: '/mocked/path/sandbox-worker.js',
}));

jest.mock('../../../src/code-mode/runtime.js');
jest.mock('../../../src/config/config-cache.js', () => ({
	configCache: {
		getConfigForPath: jest.fn(),
		getDefaultConfig: jest.fn(() => ({
			config: {
				apiUrl: 'https://api.constellationdev.io',
				branch: 'test-branch',
				languages: { typescript: { fileExtensions: ['.ts'] } },
				projectId: 'test-project',
			},
			projectId: 'test-project',
			branchName: 'test-branch',
			apiKey: 'test-key',
			configLoaded: true,
			gitRoot: '/test/project',
		})),
		hasDefaultConfig: jest.fn(() => true),
	},
	ConfigCacheError: class ConfigCacheError extends Error {},
}));

const { CodeModeRuntime: ActualCodeModeRuntime } = jest.requireActual<
	typeof import('../../../src/code-mode/runtime.js')
>('../../../src/code-mode/runtime.js');

const MockedCodeModeRuntime = CodeModeRuntime as jest.MockedClass<
	typeof CodeModeRuntime
>;

type ToolHandler = (args: {
	code: string;
	timeout?: number;
	cwd?: string;
}) => Promise<unknown>;

const timeoutBreakdown = {
	baseMs: 5000,
	calls: [{ method: 'searchSymbols', weight: 3 }],
	parallelismFactor: 1,
	estimatedMs: 11000,
	coldStartGraceMs: 0,
	appliedMs: 11000,
	warnings: [],
};

describe('code_intel golden output (no hook)', () => {
	let execute: jest.Mock<(request: unknown) => Promise<CodeModeResponse>>;
	let handler: ToolHandler;

	beforeEach(() => {
		execute = jest.fn<(request: unknown) => Promise<CodeModeResponse>>();
		MockedCodeModeRuntime.mockImplementation(
			() =>
				({
					execute,
					formatResult: ActualCodeModeRuntime.prototype.formatResult,
				}) as unknown as jest.Mocked<CodeModeRuntime>,
		);

		const server = {
			registerTool: jest.fn(
				(_name: string, _config: unknown, registered: ToolHandler) => {
					handler = registered;
				},
			),
		};
		registerQueryCodeGraphTool(
			server as unknown as Parameters<typeof registerQueryCodeGraphTool>[0],
		);
	});

	it('should return the exact text and structuredContent for a successful run', async () => {
		// Arrange
		execute.mockResolvedValue({
			success: true,
			result: { symbols: [{ id: 'sym:1', name: 'AuthService' }] },
			logs: ['[INFO] found 1'],
			executionTime: 42,
			asOfCommit: 'abc1234',
			lastIndexedAt: '2026-01-02T03:04:05.000Z',
			resultContext: {
				reason: 'results_found',
				branchIndexed: true,
				indexedFileCount: 7,
			},
			timeoutBreakdown,
			metadata: { language: 'javascript', sandboxed: true, validated: true },
		});

		// Act
		const result = await handler({
			code: 'return await api.searchSymbols({ query: "AuthService" });',
		});

		// Assert
		expect(result).toStrictEqual({
			content: [
				{
					type: 'text',
					text: '{"success":true,"asOfCommit":"abc1234","lastIndexedAt":"2026-01-02T03:04:05.000Z","resultContext":{"reason":"results_found","branchIndexed":true,"indexedFileCount":7},"timeoutBreakdown":{"baseMs":5000,"calls":[{"method":"searchSymbols","weight":3}],"parallelismFactor":1,"estimatedMs":11000,"coldStartGraceMs":0,"appliedMs":11000,"warnings":[]},"result":{"symbols":[{"id":"sym:1","name":"AuthService"}]},"logs":["[INFO] found 1"],"time":42}',
				},
			],
			structuredContent: {
				success: true,
				asOfCommit: 'abc1234',
				lastIndexedAt: '2026-01-02T03:04:05.000Z',
				resultContext: {
					reason: 'results_found',
					branchIndexed: true,
					indexedFileCount: 7,
				},
				timeoutBreakdown: {
					baseMs: 5000,
					calls: [{ method: 'searchSymbols', weight: 3 }],
					parallelismFactor: 1,
					estimatedMs: 11000,
					coldStartGraceMs: 0,
					appliedMs: 11000,
					warnings: [],
				},
				result: { symbols: [{ id: 'sym:1', name: 'AuthService' }] },
				logs: ['[INFO] found 1'],
				time: 42,
			},
		});
	});

	it('should return the exact text, structuredContent and isError for a structuredError run', async () => {
		// Arrange
		execute.mockResolvedValue({
			success: false,
			error: 'Execution timeout: Code took longer than 11000ms to execute',
			structuredError: {
				success: false,
				error: {
					code: 'EXECUTION_TIMEOUT',
					type: 'TimeoutError',
					message: 'Script execution timed out',
					recoverable: true,
					guidance: ['Scope the query down'],
					context: { tool: 'execute', projectId: 'test-project' },
				},
				formattedMessage: 'Execution timed out',
			},
			logs: ['[WARN] slow'],
			executionTime: 11001,
			timeoutBreakdown,
		});

		// Act
		const result = await handler({
			code: 'return await api.searchSymbols({ query: "AuthService" });',
		});

		// Assert
		expect(result).toStrictEqual({
			content: [
				{
					type: 'text',
					text: '{\n  "success": false,\n  "error": {\n    "code": "EXECUTION_TIMEOUT",\n    "type": "TimeoutError",\n    "message": "Script execution timed out",\n    "recoverable": true,\n    "guidance": [\n      "Scope the query down"\n    ],\n    "context": {\n      "tool": "execute",\n      "projectId": "test-project"\n    }\n  },\n  "formattedMessage": "Execution timed out"\n}',
				},
			],
			structuredContent: {
				success: false,
				error: 'Script execution timed out',
				timeoutBreakdown: {
					baseMs: 5000,
					calls: [{ method: 'searchSymbols', weight: 3 }],
					parallelismFactor: 1,
					estimatedMs: 11000,
					coldStartGraceMs: 0,
					appliedMs: 11000,
					warnings: [],
				},
			},
			isError: true,
		});
	});
});
