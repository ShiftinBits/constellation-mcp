/**
 * Sandbox Worker Unit Tests (SB-258 Step 3.1)
 *
 * Tests the child process entry point for isolated sandbox execution.
 * Validates IPC message handling, execution flow, and error propagation.
 */

import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach,
} from '@jest/globals';
import type {
	WorkerRequest,
	WorkerResponse,
} from '../../../src/code-mode/sandbox-worker.js';

// Mock CodeModeSandbox to avoid real execution in unit tests
// Variables prefixed with 'mock' can be referenced inside jest.mock() factories
const mockExecute = jest.fn<(...args: any[]) => Promise<any>>();
const mockValidateCode = jest.fn().mockReturnValue({ valid: true });
const mockCodeModeSandboxConstructor = jest.fn().mockImplementation(() => ({
	execute: mockExecute,
	validateCode: mockValidateCode,
}));

jest.mock('../../../src/code-mode/sandbox.js', () => ({
	CodeModeSandbox: mockCodeModeSandboxConstructor,
}));

// Mock process.send and process.exit
const originalSend = process.send;
const originalExit = process.exit;

describe('sandbox-worker', () => {
	let messageHandler: ((msg: WorkerRequest) => void) | undefined;
	let sentMessages: WorkerResponse[] = [];

	beforeEach(() => {
		jest.clearAllMocks();
		sentMessages = [];

		// Mock process.send to capture IPC messages
		process.send = jest.fn((msg: any) => {
			sentMessages.push(msg);
			return true;
		}) as any;

		// Mock process.exit to prevent test process from exiting
		process.exit = jest.fn() as any;

		// Capture the message handler registered by the worker module
		const listeners = process.listeners('message');
		// Clear existing listeners from previous test runs
		process.removeAllListeners('message');

		// Import the worker module (registers message handler)
		// We need to re-import each time since the module registers on import
		jest.isolateModules(() => {
			require('../../../src/code-mode/sandbox-worker.js');
		});

		// Get the newly registered handler
		const newListeners = process.listeners('message');
		messageHandler = newListeners[newListeners.length - 1] as any;
	});

	afterEach(() => {
		process.send = originalSend;
		process.exit = originalExit;
		process.removeAllListeners('message');
	});

	it('should register a message handler on import', () => {
		expect(messageHandler).toBeDefined();
		expect(typeof messageHandler).toBe('function');
	});

	it('should execute code and send result back via IPC', async () => {
		const expectedResult = {
			success: true,
			result: { symbols: [] },
			logs: [],
			executionTime: 15,
		};
		mockExecute.mockResolvedValueOnce(expectedResult);

		const request: WorkerRequest = {
			type: 'execute',
			code: 'await api.searchSymbols({ query: "test" })',
			config: {
				apiUrl: 'http://localhost:3000',
				apiKey: 'test-key',
				projectId: 'test-project',
				branchName: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
				gitRoot: '/test/project',
			},
			options: {
				timeout: 5000,
			},
		};

		messageHandler!(request);

		// Wait for async execution to complete
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(mockExecute).toHaveBeenCalledWith(request.code);
		expect(process.send).toHaveBeenCalled();
		expect(sentMessages.length).toBe(1);
		expect(sentMessages[0]).toEqual({
			type: 'result',
			result: expectedResult,
		});
	});

	it('should send error response when execution fails', async () => {
		mockExecute.mockRejectedValueOnce(new Error('Execution failed'));

		const request: WorkerRequest = {
			type: 'execute',
			code: 'throw new Error("boom")',
			config: {
				apiUrl: 'http://localhost:3000',
				apiKey: 'test-key',
				projectId: 'test-project',
				branchName: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
				gitRoot: '/test/project',
			},
			options: {},
		};

		messageHandler!(request);

		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(sentMessages.length).toBe(1);
		expect(sentMessages[0]).toEqual({
			type: 'error',
			error: 'Execution failed',
		});
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should handle unknown message types', () => {
		const badMessage = { type: 'unknown' } as any;
		messageHandler!(badMessage);

		// Should have been called synchronously
		expect(sentMessages.length).toBe(1);
		expect(sentMessages[0].type).toBe('error');
		expect((sentMessages[0] as any).error).toContain('Unknown message type');
	});

	it('should call process.exit after sending response', async () => {
		mockExecute.mockResolvedValueOnce({
			success: true,
			result: 42,
			executionTime: 5,
		});

		const request: WorkerRequest = {
			type: 'execute',
			code: '42',
			config: {
				apiUrl: 'http://localhost:3000',
				apiKey: 'test-key',
				projectId: 'test-project',
				branchName: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
				gitRoot: '/test/project',
			},
			options: {},
		};

		messageHandler!(request);

		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(process.exit).toHaveBeenCalledWith(0);
	});

	it('should pass sandbox options from request to CodeModeSandbox', async () => {
		mockExecute.mockResolvedValueOnce({
			success: true,
			result: null,
			executionTime: 1,
		});

		const request: WorkerRequest = {
			type: 'execute',
			code: 'null',
			config: {
				apiUrl: 'http://test.com',
				apiKey: 'key-123',
				projectId: 'proj-1',
				branchName: 'feature',
				languages: { typescript: { fileExtensions: ['.ts', '.tsx'] } },
				gitRoot: '/test/project',
			},
			options: {
				timeout: 10000,
				memoryLimit: 256,
				allowConsole: false,
				allowTimers: true,
				maxApiCalls: 100,
			},
		};

		messageHandler!(request);

		await new Promise((resolve) => setTimeout(resolve, 10));

		// Use the top-level mock (not jest.requireMock) since jest.isolateModules
		// creates a fresh registry — the mock factory references this same variable
		expect(mockCodeModeSandboxConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				timeout: 10000,
				memoryLimit: 256,
				allowConsole: false,
				allowTimers: true,
				maxApiCalls: 100,
				projectContext: {
					projectId: 'proj-1',
					branchName: 'feature',
				},
			}),
		);
	});
});
