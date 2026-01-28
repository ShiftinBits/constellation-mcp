/**
 * CodeModeRuntime Unit Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CodeModeRuntime } from '../../../src/code-mode/runtime.js';
import { CodeModeSandbox } from '../../../src/code-mode/sandbox.js';
import { ConstellationConfig } from '../../../src/config/config.js';
import type { ConfigContext } from '../../../src/config/config-cache.js';

// Mock the sandbox module
jest.mock('../../../src/code-mode/sandbox.js');

const MockedCodeModeSandbox = CodeModeSandbox as jest.MockedClass<
	typeof CodeModeSandbox
>;

// Create a mock config for testing
const createMockConfigContext = (): ConfigContext => ({
	config: {
		apiUrl: 'http://localhost:3000',
		branch: 'test-branch',
		languages: { typescript: { fileExtensions: ['.ts'] } },
		projectId: 'test-project',
		validate: jest.fn(),
	} as unknown as ConstellationConfig,
	projectId: 'test-project',
	branchName: 'test-branch',
	apiKey: 'test-key',
	configLoaded: true,
	gitRoot: '/test/project',
});

describe('CodeModeRuntime', () => {
	let runtime: CodeModeRuntime;
	let mockSandbox: jest.Mocked<CodeModeSandbox>;
	let mockConfigContext: ConfigContext;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mock config context
		mockConfigContext = createMockConfigContext();

		// Create mock sandbox instance
		mockSandbox = {
			validateCode: jest.fn(),
			execute: jest.fn(),
		} as any;

		// Mock the sandbox constructor to return our mock instance
		MockedCodeModeSandbox.mockImplementation(() => mockSandbox);

		runtime = new CodeModeRuntime({
			timeout: 5000,
			allowConsole: true,
			configContext: mockConfigContext,
		});
	});

	describe('constructor', () => {
		it('should create CodeModeSandbox with provided options', () => {
			const options = {
				timeout: 10000,
				allowConsole: false,
				configContext: mockConfigContext,
			};
			new CodeModeRuntime(options);

			expect(MockedCodeModeSandbox).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 10000,
					allowConsole: false,
					configContext: mockConfigContext,
				}),
			);
		});

		it('should pass configContext to CodeModeSandbox', () => {
			new CodeModeRuntime({ configContext: mockConfigContext });

			expect(MockedCodeModeSandbox).toHaveBeenCalledWith(
				expect.objectContaining({
					configContext: mockConfigContext,
				}),
			);
		});
	});

	describe('execute', () => {
		it('should execute valid JavaScript code', async () => {
			const code = 'return 42;';

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: 42,
				logs: [],
				executionTime: 10,
			});

			const result = await runtime.execute({ code });

			expect(result.success).toBe(true);
			expect(result.result).toBe(42);
			expect(result.executionTime).toBe(10);
			expect(result.metadata).toEqual({
				language: 'javascript',
				sandboxed: true,
				validated: true,
			});
		});

		it('should return validation error when code is invalid', async () => {
			const code = 'invalid code here';

			mockSandbox.validateCode.mockReturnValue({
				valid: false,
				errors: ['Dangerous code detected', 'Invalid syntax'],
			});

			const result = await runtime.execute({ code });

			expect(result.success).toBe(false);
			expect(result.error).toContain('Code validation failed');
			expect(result.error).toContain('Dangerous code detected');
			expect(result.error).toContain('Invalid syntax');
			expect(result.metadata).toEqual({
				language: 'javascript',
				sandboxed: false,
				validated: false,
			});
			expect(mockSandbox.execute).not.toHaveBeenCalled();
		});

		it('should handle execution errors', async () => {
			const code = 'throw new Error("test error");';

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: false,
				error: 'Error: test error',
				logs: ['Error occurred'],
				executionTime: 5,
			});

			const result = await runtime.execute({ code });

			expect(result.success).toBe(false);
			expect(result.error).toBe('Error: test error');
			expect(result.logs).toEqual(['Error occurred']);
		});

		it('should include logs in response', async () => {
			const code = 'console.log("test"); return 1;';

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: 1,
				logs: ['test'],
				executionTime: 8,
			});

			const result = await runtime.execute({ code });

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['test']);
		});

		it('should pass asOfCommit from sandbox to response', async () => {
			const commitHash = 'abc123def456abc123def456abc123def456abc1';

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: { symbols: [] },
				logs: [],
				executionTime: 10,
				asOfCommit: commitHash,
			});

			const result = await runtime.execute({
				code: 'return await api.searchSymbols({})',
			});

			expect(result.success).toBe(true);
			expect(result.asOfCommit).toBe(commitHash);
		});

		it('should not include asOfCommit when sandbox does not provide one', async () => {
			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: 42,
				logs: [],
				executionTime: 10,
			});

			const result = await runtime.execute({ code: 'return 42' });

			expect(result.success).toBe(true);
			expect(result.asOfCommit).toBeUndefined();
		});

		it('should always use javascript language', async () => {
			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: null,
				logs: [],
				executionTime: 5,
			});

			const result = await runtime.execute({ code: 'return null;' });

			expect(result.metadata?.language).toBe('javascript');
		});

		it('should log validation warnings to console and include in logs', async () => {
			const code = 'return 42;';
			const consoleErrorSpy = jest.spyOn(console, 'error');

			mockSandbox.validateCode.mockReturnValue({
				valid: true,
				warnings: ['API call without return statement', 'Consider using await'],
			});
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: 42,
				logs: ['execution log'],
				executionTime: 10,
			});

			const result = await runtime.execute({ code });

			expect(result.success).toBe(true);
			// Warnings should be logged to console.error
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Warning: API call without return statement'),
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Warning: Consider using await'),
			);
			// Warnings should be included in logs with [WARN] prefix
			expect(result.logs).toContain('[WARN] API call without return statement');
			expect(result.logs).toContain('[WARN] Consider using await');
			// Original execution logs should also be present
			expect(result.logs).toContain('execution log');

			consoleErrorSpy.mockRestore();
		});

		it('should combine warning logs with execution logs', async () => {
			mockSandbox.validateCode.mockReturnValue({
				valid: true,
				warnings: ['warning1'],
			});
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: 'test',
				logs: ['log1', 'log2'],
				executionTime: 5,
			});

			const result = await runtime.execute({ code: 'return "test";' });

			expect(result.logs).toEqual(['[WARN] warning1', 'log1', 'log2']);
		});

		it('should warn when result size exceeds 100KB', async () => {
			const largeData = 'x'.repeat(150 * 1024); // 150KB string
			const consoleErrorSpy = jest.spyOn(console, 'error');

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: largeData,
				logs: [],
				executionTime: 50,
			});

			const result = await runtime.execute({ code: 'return largeData;' });

			expect(result.success).toBe(true);
			// Should log warning about large result
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Large result size'),
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('KB'),
			);
			// Should include warning in logs
			expect(
				result.logs?.some(
					(log) => log.includes('[WARN]') && log.includes('Large result size'),
				),
			).toBe(true);

			consoleErrorSpy.mockRestore();
		});

		it('should not warn when result size is under 100KB', async () => {
			const smallData = 'x'.repeat(50 * 1024); // 50KB string
			const consoleErrorSpy = jest.spyOn(console, 'error');

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: smallData,
				logs: [],
				executionTime: 30,
			});

			const result = await runtime.execute({ code: 'return smallData;' });

			expect(result.success).toBe(true);
			// Should NOT log warning about large result
			const largeSizeWarnings = consoleErrorSpy.mock.calls.filter((call) =>
				(call[0] as string).includes('Large result size'),
			);
			expect(largeSizeWarnings.length).toBe(0);
			// Logs should be undefined (empty array gets filtered)
			expect(result.logs).toBeUndefined();

			consoleErrorSpy.mockRestore();
		});

		it('should handle non-serializable results gracefully for size check', async () => {
			const circularRef: any = { a: 1 };
			circularRef.self = circularRef; // Create circular reference

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: circularRef,
				logs: [],
				executionTime: 10,
			});

			// Should not throw when result can't be serialized for size check
			const result = await runtime.execute({ code: 'return circular;' });

			expect(result.success).toBe(true);
			expect(result.result).toBe(circularRef);
		});

		it('should skip size check when result is undefined', async () => {
			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: undefined,
				logs: [],
				executionTime: 5,
			});

			const result = await runtime.execute({ code: 'return;' });

			expect(result.success).toBe(true);
			expect(result.result).toBeUndefined();
		});

		// FIX SB-95: Tests for result truncation at 1MB limit
		it('should truncate array results exceeding 1MB limit', async () => {
			// Create array that exceeds 1MB
			const largeArray = Array(50000)
				.fill(null)
				.map((_, i) => ({
					id: i,
					data: 'x'.repeat(30),
				}));
			const consoleErrorSpy = jest.spyOn(console, 'error');

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: largeArray,
				logs: [],
				executionTime: 100,
			});

			const result = await runtime.execute({ code: 'return largeArray;' });

			expect(result.success).toBe(true);
			// Result should be truncated
			expect(result.result).toHaveProperty('truncated', true);
			expect(result.result).toHaveProperty('originalSizeKB');
			expect(result.result).toHaveProperty('limitKB', 1024);
			expect(result.result).toHaveProperty('message');
			expect(result.result).toHaveProperty('hint');
			// Should have array preview with first items
			expect(result.result.preview).toHaveProperty('type', 'array');
			expect(result.result.preview).toHaveProperty('totalItems', 50000);
			expect(result.result.preview.items.length).toBeLessThanOrEqual(5);
			// Should log truncation warning
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Result truncated'),
			);
			// Should include warning in logs
			expect(
				result.logs?.some(
					(log) => log.includes('[WARN]') && log.includes('Result truncated'),
				),
			).toBe(true);

			consoleErrorSpy.mockRestore();
		});

		it('should truncate object results exceeding 1MB limit', async () => {
			// Create object that exceeds 1MB
			const largeObject: Record<string, string> = {};
			for (let i = 0; i < 5000; i++) {
				largeObject[`key${i}`] = 'x'.repeat(250);
			}
			const consoleErrorSpy = jest.spyOn(console, 'error');

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: largeObject,
				logs: [],
				executionTime: 100,
			});

			const result = await runtime.execute({ code: 'return largeObject;' });

			expect(result.success).toBe(true);
			// Result should be truncated
			expect(result.result).toHaveProperty('truncated', true);
			// Should have object preview with keys
			expect(result.result.preview).toHaveProperty('type', 'object');
			expect(result.result.preview).toHaveProperty('totalKeys', 5000);
			expect(result.result.preview.keys.length).toBeLessThanOrEqual(20);

			consoleErrorSpy.mockRestore();
		});

		it('should truncate string results exceeding 1MB limit', async () => {
			// Create string that exceeds 1MB
			const largeString = 'x'.repeat(1.5 * 1024 * 1024); // 1.5MB
			const consoleErrorSpy = jest.spyOn(console, 'error');

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: largeString,
				logs: [],
				executionTime: 100,
			});

			const result = await runtime.execute({ code: 'return largeString;' });

			expect(result.success).toBe(true);
			// Result should be truncated
			expect(result.result).toHaveProperty('truncated', true);
			// Should have string preview
			expect(result.result.preview).toHaveProperty('type', 'string');
			expect(result.result.preview.content.length).toBeLessThanOrEqual(1004); // 1000 + '...'

			consoleErrorSpy.mockRestore();
		});

		it('should not truncate results under 1MB limit (but over 100KB)', async () => {
			// Create data between 100KB and 1MB - should warn but not truncate
			const mediumData = 'x'.repeat(500 * 1024); // 500KB
			const consoleErrorSpy = jest.spyOn(console, 'error');

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: mediumData,
				logs: [],
				executionTime: 50,
			});

			const result = await runtime.execute({ code: 'return mediumData;' });

			expect(result.success).toBe(true);
			// Result should NOT be truncated
			expect(result.result).toBe(mediumData);
			expect(result.result).not.toHaveProperty('truncated');
			// Should log warning about large result (but not truncation)
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Large result size'),
			);
			expect(consoleErrorSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('Result truncated'),
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe('formatResult', () => {
		it('should format successful result with data', () => {
			const response = {
				success: true,
				result: { data: 'test' },
				logs: ['log1', 'log2'],
				executionTime: 100,
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.success).toBe(true);
			expect(parsed.result).toEqual({ data: 'test' });
			expect(parsed.logs).toEqual(['log1', 'log2']);
			expect(parsed.time).toBe(100);
		});

		it('should format successful result without logs', () => {
			const response = {
				success: true,
				result: 42,
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.success).toBe(true);
			expect(parsed.result).toBe(42);
			expect(parsed.logs).toBeUndefined();
		});

		it('should format error result', () => {
			const response = {
				success: false,
				error: 'Test error message',
				logs: ['error log'],
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.success).toBe(false);
			expect(parsed.error).toBe('Test error message');
			expect(parsed.logs).toEqual(['error log']);
		});

		it('should format error result without logs', () => {
			const response = {
				success: false,
				error: 'Test error',
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.success).toBe(false);
			expect(parsed.error).toBe('Test error');
			expect(parsed.logs).toBeUndefined();
		});

		it('should handle undefined result', () => {
			const response = {
				success: true,
				result: undefined,
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.success).toBe(true);
			expect(parsed.result).toBeUndefined();
		});

		it('should handle null result', () => {
			const response = {
				success: true,
				result: null,
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.success).toBe(true);
			expect(parsed.result).toBeNull();
		});

		it('should handle empty logs array', () => {
			const response = {
				success: true,
				result: 'test',
				logs: [],
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.logs).toBeUndefined(); // Empty arrays are omitted
		});

		it('should include asOfCommit in formatted output', () => {
			const commitHash = 'abc123def456abc123def456abc123def456abc1';
			const response = {
				success: true,
				result: { data: 'test' },
				asOfCommit: commitHash,
				executionTime: 100,
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.asOfCommit).toBe(commitHash);
		});

		it('should not include asOfCommit when not present', () => {
			const response = {
				success: true,
				result: 42,
			};

			const formatted = runtime.formatResult(response);
			const parsed = JSON.parse(formatted);

			expect(parsed.asOfCommit).toBeUndefined();
		});
	});

	// Note: createCodeModeRuntime was removed - callers must now provide configContext explicitly
	// This supports multi-project workspaces where config is resolved per-call.

	describe('structuredError passthrough', () => {
		it('should pass structuredError from sandbox to response', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'AUTH_ERROR' as const,
					type: 'AuthenticationError',
					message: 'Invalid API key',
					recoverable: true,
					guidance: ['Run: constellation auth'],
				},
				formattedMessage: 'Authentication failed',
			};

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: false,
				error: 'Authentication failed',
				structuredError,
				logs: [],
				executionTime: 10,
			});

			const result = await runtime.execute({
				code: 'return await api.searchSymbols({})',
			});

			expect(result.success).toBe(false);
			expect(result.structuredError).toBeDefined();
			expect(result.structuredError).toEqual(structuredError);
		});

		it('should include structuredError in CodeModeResponse', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'NOT_CONFIGURED' as const,
					type: 'ConfigurationError',
					message: 'constellation.json not found',
					recoverable: true,
					guidance: ['Run: constellation init'],
				},
				formattedMessage: 'Configuration error',
			};

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: false,
				error: 'Configuration error',
				structuredError,
				logs: [],
				executionTime: 5,
			});

			const result = await runtime.execute({ code: 'return 42' });

			expect(result.structuredError?.error.code).toBe('NOT_CONFIGURED');
			expect(result.structuredError?.error.type).toBe('ConfigurationError');
			expect(result.structuredError?.error.recoverable).toBe(true);
		});

		it('should not include structuredError for successful execution', async () => {
			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: true,
				result: 42,
				logs: [],
				executionTime: 10,
			});

			const result = await runtime.execute({ code: 'return 42' });

			expect(result.success).toBe(true);
			expect(result.structuredError).toBeUndefined();
		});

		it('should preserve error.code in structuredError passthrough', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'EXECUTION_TIMEOUT' as const,
					type: 'TimeoutError',
					message: 'Execution timed out',
					recoverable: true,
					guidance: ['Reduce the scope of your query'],
				},
				formattedMessage: 'Timeout error',
			};

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: false,
				error: 'Timeout error',
				structuredError,
				logs: [],
				executionTime: 30000,
			});

			const result = await runtime.execute({
				code: 'return await api.getCallGraph({})',
			});

			expect(result.structuredError?.error.code).toBe('EXECUTION_TIMEOUT');
		});

		it('should include guidance array in structuredError passthrough', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'PROJECT_NOT_INDEXED' as const,
					type: 'NotFoundError',
					message: 'Project not indexed',
					recoverable: true,
					guidance: [
						'Run: constellation index',
						'Verify project configuration',
					],
				},
				formattedMessage: 'Project not found',
			};

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: false,
				error: 'Project not indexed',
				structuredError,
				logs: [],
				executionTime: 15,
			});

			const result = await runtime.execute({
				code: 'return await api.searchSymbols({})',
			});

			expect(result.structuredError?.error.guidance).toHaveLength(2);
			expect(result.structuredError?.error.guidance).toContain(
				'Run: constellation index',
			);
		});

		it('should include context in structuredError when present', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'AUTH_ERROR' as const,
					type: 'AuthenticationError',
					message: 'Invalid API key',
					recoverable: true,
					guidance: ['Run: constellation auth'],
					context: {
						tool: 'search_symbols',
						projectId: 'test-project',
						branchName: 'main',
						apiMethod: 'searchSymbols',
					},
				},
				formattedMessage: 'Authentication failed',
			};

			mockSandbox.validateCode.mockReturnValue({ valid: true });
			mockSandbox.execute.mockResolvedValue({
				success: false,
				error: 'Authentication failed',
				structuredError,
				logs: [],
				executionTime: 10,
			});

			const result = await runtime.execute({
				code: 'return await api.searchSymbols({})',
			});

			expect(result.structuredError?.error.context).toBeDefined();
			expect(result.structuredError?.error.context?.projectId).toBe(
				'test-project',
			);
			expect(result.structuredError?.error.context?.apiMethod).toBe(
				'searchSymbols',
			);
		});
	});
});
