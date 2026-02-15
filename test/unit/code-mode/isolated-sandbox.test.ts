/**
 * IsolatedSandbox Unit Tests (SB-258 Step 3.1)
 *
 * Tests the parent-side IPC wrapper for child process isolation.
 * Uses mocked child_process.fork() to avoid spawning real processes.
 */

import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach,
} from '@jest/globals';
import { EventEmitter } from 'events';
import { ConstellationConfig } from '../../../src/config/config.js';
import type { ConfigContext } from '../../../src/config/config-cache.js';

// Mock worker-path to avoid import.meta.url (not supported in ts-jest CJS mode)
jest.mock('../../../src/code-mode/worker-path.js', () => ({
	WORKER_PATH: '/mocked/path/sandbox-worker.js',
}));

// Mock child_process.fork
jest.mock('child_process', () => ({
	fork: jest.fn(),
}));

// Mock CodeModeSandbox for validation delegation
jest.mock('../../../src/code-mode/sandbox.js', () => ({
	CodeModeSandbox: jest.fn().mockImplementation(() => ({
		validateCode: jest.fn().mockReturnValue({ valid: true }),
	})),
}));

// Import after mocks
import { IsolatedSandbox } from '../../../src/code-mode/isolated-sandbox.js';
import { fork } from 'child_process';
const mockFork = fork as jest.MockedFunction<typeof fork>;

const createMockConfigContext = (): ConfigContext => ({
	config: new ConstellationConfig(
		'http://test-api.com',
		'test-branch',
		{ typescript: { fileExtensions: ['.ts'] } },
		'test-project',
	),
	projectId: 'test-project',
	branchName: 'test-branch',
	apiKey: 'test-api-key',
	configLoaded: true,
	gitRoot: '/test/project',
});

/**
 * Create a mock child process (EventEmitter with send/kill methods)
 */
function createMockChild() {
	const child = new EventEmitter() as EventEmitter & {
		send: jest.Mock;
		kill: jest.Mock;
		unref: jest.Mock;
		pid: number;
	};
	child.send = jest.fn();
	child.kill = jest.fn();
	child.unref = jest.fn();
	child.pid = 12345;
	return child;
}

describe('IsolatedSandbox', () => {
	let sandbox: IsolatedSandbox;
	let mockChild: ReturnType<typeof createMockChild>;

	beforeEach(() => {
		jest.useFakeTimers();
		mockChild = createMockChild();
		mockFork.mockReturnValue(mockChild as any);

		sandbox = new IsolatedSandbox({
			timeout: 5000,
			memoryLimit: 64,
			allowConsole: true,
			configContext: createMockConfigContext(),
		});
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	describe('execute', () => {
		it('should fork a child process with memory limit flag', async () => {
			const executePromise = sandbox.execute('const x = 1');

			// Simulate successful result from worker
			mockChild.emit('message', {
				type: 'result',
				result: {
					success: true,
					result: 1,
					executionTime: 10,
				},
			});

			await executePromise;

			expect(mockFork).toHaveBeenCalledWith(
				expect.any(String),
				[],
				expect.objectContaining({
					execArgv: ['--max-old-space-size=64'],
					silent: true,
				}),
			);
		});

		it('should send execution request via IPC', async () => {
			const executePromise = sandbox.execute('const x = 1');

			mockChild.emit('message', {
				type: 'result',
				result: { success: true, result: 1, executionTime: 10 },
			});

			await executePromise;

			expect(mockChild.send).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'execute',
					code: 'const x = 1',
					config: expect.objectContaining({
						apiUrl: 'http://test-api.com',
						apiKey: 'test-api-key',
						projectId: 'test-project',
						branchName: 'test-branch',
					}),
					options: expect.objectContaining({
						timeout: 5000,
						memoryLimit: 64,
						allowConsole: true,
					}),
				}),
			);
		});

		it('should return SandboxResult from worker', async () => {
			const expectedResult = {
				success: true,
				result: { symbols: ['foo'] },
				logs: ['found 1 symbol'],
				executionTime: 42,
			};

			const executePromise = sandbox.execute('api.searchSymbols({})');
			mockChild.emit('message', { type: 'result', result: expectedResult });

			const result = await executePromise;
			expect(result).toEqual(expectedResult);
		});

		it('should handle worker error response', async () => {
			const executePromise = sandbox.execute('bad code');
			mockChild.emit('message', {
				type: 'error',
				error: 'Syntax error in code',
			});

			const result = await executePromise;
			expect(result.success).toBe(false);
			expect(result.error).toBe('Syntax error in code');
		});

		it('should kill child on timeout and return error', async () => {
			const executePromise = sandbox.execute('while(true){}');

			// Advance past timeout (5000ms + 1000ms buffer)
			jest.advanceTimersByTime(6001);

			const result = await executePromise;
			expect(result.success).toBe(false);
			expect(result.error).toContain('Execution timeout');
			expect(result.error).toContain('hardened mode');
			expect(mockChild.kill).toHaveBeenCalledWith('SIGKILL');
		});

		it('should handle child process spawn error', async () => {
			const executePromise = sandbox.execute('const x = 1');
			mockChild.emit('error', new Error('Failed to spawn'));

			const result = await executePromise;
			expect(result.success).toBe(false);
			expect(result.error).toContain('Worker process error');
			expect(result.error).toContain('Failed to spawn');
		});

		it('should handle child process crash (non-zero exit)', async () => {
			const executePromise = sandbox.execute('const x = 1');
			mockChild.emit('exit', 1, null);

			const result = await executePromise;
			expect(result.success).toBe(false);
			expect(result.error).toContain('Worker exited with code 1');
		});

		it('should handle SIGKILL exit (memory exceeded)', async () => {
			const executePromise = sandbox.execute('const arr = []');
			mockChild.emit('exit', null, 'SIGKILL');

			const result = await executePromise;
			expect(result.success).toBe(false);
			expect(result.error).toContain('SIGKILL');
			expect(result.error).toContain('64MB');
		});

		it('should include executionTime in all error responses', async () => {
			jest.useRealTimers(); // Need real time for this test
			const executePromise = sandbox.execute('const x = 1');
			mockChild.emit('error', new Error('test'));

			const result = await executePromise;
			expect(result.executionTime).toBeGreaterThanOrEqual(0);
			jest.useFakeTimers(); // Restore for afterEach
		});
	});

	describe('validateCode', () => {
		it('should delegate validation to CodeModeSandbox', () => {
			const result = sandbox.validateCode('const x = 1');
			expect(result.valid).toBe(true);
		});

		it('should reject dangerous code before spawning child', async () => {
			// Override mock to return invalid
			const { CodeModeSandbox } = jest.requireMock(
				'../../../src/code-mode/sandbox.js',
			) as any;
			CodeModeSandbox.mockImplementationOnce(() => ({
				validateCode: jest.fn().mockReturnValue({
					valid: false,
					errors: ['dangerous pattern detected'],
				}),
			}));

			const isolatedSandbox = new IsolatedSandbox({
				timeout: 5000,
				configContext: createMockConfigContext(),
			});

			const result = await isolatedSandbox.execute('process.exit()');
			expect(result.success).toBe(false);
			expect(result.error).toContain('Security validation failed');
			// Should NOT have forked a child process
			expect(mockFork).not.toHaveBeenCalled();
		});
	});
});
