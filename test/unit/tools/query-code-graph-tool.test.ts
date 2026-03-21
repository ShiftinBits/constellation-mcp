/**
 * Query Code Graph Tool Registration Tests
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CodeModeRuntime } from '../../../src/code-mode/runtime.js';
import type { ConfigContext } from '../../../src/config/config-cache.js';
import { ConstellationConfig } from '../../../src/config/config.js';
import { registerQueryCodeGraphTool } from '../../../src/tools/query-code-graph-tool.js';

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

// Mock worker-path to avoid import.meta.url (not supported in ts-jest CJS mode)
jest.mock('../../../src/code-mode/worker-path.js', () => ({
	WORKER_PATH: '/mocked/path/sandbox-worker.js',
}));

// Mock dependencies
jest.mock('../../../src/code-mode/runtime.js');
jest.mock('../../../src/config/config-cache.js', () => ({
	configCache: {
		getConfigForPath: jest.fn(),
		getDefaultConfig: jest.fn(() => ({
			config: {
				apiUrl: 'http://localhost:3000',
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

const MockedCodeModeRuntime = CodeModeRuntime as jest.MockedClass<
	typeof CodeModeRuntime
>;

describe('registerQueryCodeGraphTool', () => {
	let mockServer: any;
	let mockRuntime: jest.Mocked<CodeModeRuntime>;
	let registeredHandler: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mock runtime instance
		mockRuntime = {
			execute: jest.fn(),
			formatResult: jest.fn(),
		} as any;

		MockedCodeModeRuntime.mockImplementation(() => mockRuntime);

		// Create mock MCP server
		mockServer = {
			registerTool: jest.fn((name, config, handler) => {
				registeredHandler = handler;
			}),
		};

		// Register the tool
		registerQueryCodeGraphTool(mockServer);
	});

	describe('tool registration', () => {
		it('should register code_intel tool with server', () => {
			expect(mockServer.registerTool).toHaveBeenCalledWith(
				'code_intel',
				expect.objectContaining({
					title: expect.stringContaining('Code Intelligence'),
					description: expect.stringMatching(/^DECISION RULE:/),
				}),
				expect.any(Function),
			);
		});

		it('should include decision-rule classification in tool description', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			// Pattern interrupt question
			expect(config.description).toContain('Is this a STRUCTURE question');
			expect(config.description).toContain('TEXT question');
			// NOT FOR section clarifies what to use other tools for
			expect(config.description).toContain('NOT FOR:');
			expect(config.description).toContain('literal string search');
			expect(config.description).toContain('Grep/Glob/Read');
		});

		it('should include proactive internal-reasoning triggers in tool description', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			expect(config.description).toContain('USE IMMEDIATELY WHEN');
			expect(config.description).toContain('BEFORE using Edit');
			expect(config.description).toContain(
				'BEFORE exploring an unfamiliar codebase',
			);
			expect(config.description).toContain('BEFORE refactoring');
		});

		it('should lead with DECISION RULE before quick start', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			const decisionRuleIndex = config.description.indexOf('DECISION RULE:');
			const quickStartIndex = config.description.indexOf('QUICK START:');
			expect(decisionRuleIndex).toBeGreaterThanOrEqual(0);
			expect(quickStartIndex).toBeGreaterThan(decisionRuleIndex);
		});

		it('should include availability guidance in tool description', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			expect(config.description).toContain('getCapabilities()');
		});

		it('should not use symbolName in impactAnalysis tool description examples', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			expect(config.description).not.toContain('symbolName: "Config"');
		});

		it('should include a quick-start example in tool description', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			expect(config.description).toContain('api.searchSymbols');
			expect(config.description).toContain('QUICK START');
		});

		it('should include wrong-tool detector in tool description', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			expect(config.description).toContain('3+ Grep calls');
			expect(config.description).toContain('STOP');
		});

		it('should include refactoring and planning triggers in tool description', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			expect(config.description).toContain('USE IMMEDIATELY WHEN');
			expect(config.description).toContain('BEFORE refactoring');
		});

		it('should include cwd requirement in tool description', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];
			expect(config.description).toContain('cwd');
			expect(config.description).toContain('required');
		});

		it('should register with correct input schema including required cwd', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];

			expect(config.inputSchema.code).toBeDefined();
			expect(config.inputSchema.timeout).toBeDefined();
			expect(config.inputSchema.cwd).toBeDefined();
		});

		it('should register with correct output schema', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];

			expect(config.outputSchema.success).toBeDefined();
			expect(config.outputSchema.result).toBeDefined();
			expect(config.outputSchema.logs).toBeDefined();
			expect(config.outputSchema.time).toBeDefined();
			expect(config.outputSchema.asOfCommit).toBeDefined();
			expect(config.outputSchema.error).toBeDefined();
		});
	});

	describe('tool handler', () => {
		it('should execute JavaScript code successfully', async () => {
			const mockResponse = {
				success: true,
				result: 42,
				logs: ['test log'],
				executionTime: 100,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(
				JSON.stringify(mockResponse, null, 2),
			);

			const result = await registeredHandler({
				code: 'return 42;',
				timeout: 5000,
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0].type).toBe('text');
			expect(result.content[0].text).toContain('"success": true');
			// structuredContent is transformed to match outputSchema (time instead of executionTime)
			expect(result.structuredContent).toEqual({
				success: true,
				result: 42,
				logs: ['test log'],
				time: 100,
			});
			expect(result.isError).toBeUndefined();
		});

		it('should create runtime with correct options', async () => {
			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: null,
			});
			mockRuntime.formatResult.mockReturnValue('{}');

			await registeredHandler({
				code: 'return 1;',
				timeout: 10000,
			});

			expect(MockedCodeModeRuntime).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 10000,
					allowConsole: true,
					allowTimers: false,
					configContext: expect.any(Object),
				}),
			);
		});

		it('should use default timeout when not provided', async () => {
			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: null,
			});
			mockRuntime.formatResult.mockReturnValue('{}');

			await registeredHandler({
				code: 'return 1;',
			});

			expect(MockedCodeModeRuntime).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 30000,
				}),
			);
		});

		it('should pass code to runtime.execute', async () => {
			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: null,
			});
			mockRuntime.formatResult.mockReturnValue('{}');

			const code = 'const x = 42; return x;';
			await registeredHandler({
				code,
				timeout: 5000,
			});

			expect(mockRuntime.execute).toHaveBeenCalledWith({
				code,
				timeout: 5000,
			});
		});

		it('should handle execution errors', async () => {
			const error = new Error('Execution failed');
			mockRuntime.execute.mockRejectedValue(error);

			const result = await registeredHandler({
				code: 'throw new Error("test");',
			});

			expect(result.content[0].type).toBe('text');
			expect(result.content[0].text).toContain('"success": false');
			expect(result.content[0].text).toContain('Execution failed');
			expect(result.isError).toBe(true);
			expect(result.structuredContent).toEqual({
				success: false,
				error: expect.any(String),
			});
		});

		it('should handle non-Error exceptions', async () => {
			mockRuntime.execute.mockRejectedValue('String error');

			const result = await registeredHandler({
				code: 'throw "error";',
			});

			expect(result.content[0].text).toContain('"success": false');
			expect(result.content[0].text).toContain('String error');
			expect(result.isError).toBe(true);
			expect(result.structuredContent).toEqual({
				success: false,
				error: expect.any(String),
			});
		});

		it('should include logs in response', async () => {
			const mockResponse = {
				success: true,
				result: 1,
				logs: ['log1', 'log2', 'log3'],
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse));

			const result = await registeredHandler({
				code: 'console.log("test"); return 1;',
			});

			expect(result.structuredContent.logs).toEqual(['log1', 'log2', 'log3']);
		});

		it('should include execution time in response', async () => {
			const mockResponse = {
				success: true,
				result: 42,
				executionTime: 250,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse));

			const result = await registeredHandler({
				code: 'return 42;',
			});

			// structuredContent uses 'time' to match outputSchema
			expect(result.structuredContent.time).toBe(250);
		});

		it('should include asOfCommit in structuredContent when present', async () => {
			const commitHash = 'abc123def456abc123def456abc123def456abc1';
			const mockResponse = {
				success: true,
				result: { symbols: [] },
				executionTime: 50,
				asOfCommit: commitHash,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse));

			const result = await registeredHandler({
				code: 'return await api.searchSymbols({ query: "test" });',
			});

			expect(result.structuredContent.asOfCommit).toBe(commitHash);
		});

		it('should include lastIndexedAt in structuredContent when present', async () => {
			const timestamp = '2025-01-28T10:30:00.000Z';
			const mockResponse = {
				success: true,
				result: { symbols: [] },
				executionTime: 50,
				lastIndexedAt: timestamp,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse));

			const result = await registeredHandler({
				code: 'return await api.searchSymbols({ query: "test" });',
			});

			expect(result.structuredContent.lastIndexedAt).toBe(timestamp);
		});

		it('should not include lastIndexedAt in structuredContent when absent', async () => {
			const mockResponse = {
				success: true,
				result: 42,
				executionTime: 10,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse));

			const result = await registeredHandler({
				code: 'return 42;',
			});

			expect(result.structuredContent.lastIndexedAt).toBeUndefined();
		});

		it('should include resultContext in structuredContent when present', async () => {
			const context = {
				reason: 'no_matches',
				branchIndexed: true,
				indexedFileCount: 42,
			};
			const mockResponse = {
				success: true,
				result: { symbols: [] },
				executionTime: 50,
				resultContext: context,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse));

			const result = await registeredHandler({
				code: 'return await api.searchSymbols({ query: "test" });',
			});

			expect(result.structuredContent.resultContext).toEqual(context);
		});

		it('should not include resultContext in structuredContent when absent', async () => {
			const mockResponse = {
				success: true,
				result: 42,
				executionTime: 10,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse));

			const result = await registeredHandler({
				code: 'return 42;',
			});

			expect(result.structuredContent.resultContext).toBeUndefined();
		});

		it('should not include asOfCommit in structuredContent when absent', async () => {
			const mockResponse = {
				success: true,
				result: 42,
				executionTime: 10,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse));

			const result = await registeredHandler({
				code: 'return 42;',
			});

			expect(result.structuredContent.asOfCommit).toBeUndefined();
		});
	});

	describe('configuration error handling', () => {
		it('should return setup instructions when config has initialization error', async () => {
			// Import the mocked configCache
			const { configCache } =
				await import('../../../src/config/config-cache.js');

			// Mock configCache to return config with initialization error
			(configCache.getDefaultConfig as jest.Mock).mockReturnValue({
				config: {
					apiUrl: 'http://localhost:3000',
					branch: '',
					languages: {},
					projectId: '',
				},
				projectId: '',
				branchName: '',
				apiKey: '',
				configLoaded: false,
				gitRoot: '/test/project',
				initializationError: 'Configuration file not found',
			});

			// Re-register tool with error config
			const newServer = {
				registerTool: jest.fn((name, config, handler) => {
					registeredHandler = handler;
				}),
			} as any;
			registerQueryCodeGraphTool(newServer);

			const result = await registeredHandler({
				code: 'return 42;',
			});

			expect(result.isError).toBe(true);
			expect(result.content[0].text.toLowerCase()).toContain('configuration');
			expect(mockRuntime.execute).not.toHaveBeenCalled();
			expect(result.structuredContent).toBeDefined();
			expect(result.structuredContent.success).toBe(false);

			// Restore original mock
			(configCache.getDefaultConfig as jest.Mock).mockReturnValue({
				config: {
					apiUrl: 'http://localhost:3000',
					branch: 'test-branch',
					languages: { typescript: { fileExtensions: ['.ts'] } },
					projectId: 'test-project',
				},
				projectId: 'test-project',
				branchName: 'test-branch',
				apiKey: 'test-key',
				configLoaded: true,
				gitRoot: '/test/project',
			});
		});
	});

	describe('response format', () => {
		it('should return content with text type', async () => {
			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: 'test',
			});
			mockRuntime.formatResult.mockReturnValue(
				'{"success":true,"result":"test"}',
			);

			const result = await registeredHandler({
				code: 'return "test";',
			});

			expect(result.content).toBeInstanceOf(Array);
			expect(result.content[0]).toHaveProperty('type', 'text');
			expect(result.content[0]).toHaveProperty('text');
		});

		it('should include structured content for successful execution', async () => {
			const response = {
				success: true,
				result: { data: 'value' },
				logs: [],
			};

			mockRuntime.execute.mockResolvedValue(response);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(response));

			const result = await registeredHandler({
				code: 'return { data: "value" };',
			});

			expect(result.structuredContent).toBeDefined();
			// structuredContent is transformed to match outputSchema (empty arrays are excluded)
			expect(result.structuredContent).toEqual({
				success: true,
				result: { data: 'value' },
			});
		});

		it('should include structured content for errors', async () => {
			mockRuntime.execute.mockRejectedValue(new Error('Test error'));

			const result = await registeredHandler({
				code: 'throw new Error();',
			});

			expect(result.structuredContent).toBeDefined();
			expect(result.structuredContent).toEqual({
				success: false,
				error: expect.any(String),
			});
			expect(result.isError).toBe(true);
		});
	});

	describe('input validation', () => {
		it('should reject code exceeding 100KB size limit', async () => {
			// Create code just over 100KB (100 * 1024 + 1 bytes)
			const largeCode = 'a'.repeat(100 * 1024 + 1);

			const result = await registeredHandler({
				code: largeCode,
			});

			expect(result.isError).toBe(true);

			// Parse the JSON response
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.success).toBe(false);
			expect(parsed.error.code).toBe('VALIDATION_ERROR');
			expect(parsed.error.type).toBe('ValidationError');
			expect(parsed.error.message).toContain('exceeds maximum allowed');
			expect(parsed.error.recoverable).toBe(true);
			expect(parsed.error.guidance).toContain(
				'Reduce code size by removing unnecessary code',
			);
			expect(result.structuredContent).toEqual({
				success: false,
				error: expect.stringContaining('exceeds maximum'),
			});

			// Should not call runtime.execute
			expect(mockRuntime.execute).not.toHaveBeenCalled();
		});

		it('should accept code at exactly 100KB size limit', async () => {
			// Create code at exactly 100KB (100 * 1024 bytes)
			const maxCode = 'a'.repeat(100 * 1024);

			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: 'ok',
			});
			mockRuntime.formatResult.mockReturnValue(
				'{"success":true,"result":"ok"}',
			);

			const result = await registeredHandler({
				code: maxCode,
			});

			// Should call runtime.execute since it's at the limit, not over
			expect(mockRuntime.execute).toHaveBeenCalled();
			expect(result.isError).toBeUndefined();
		});

		it('should reject code containing binary/control characters', async () => {
			// Code with null byte (control character)
			const codeWithNull = 'return 1;\x00';

			const result = await registeredHandler({
				code: codeWithNull,
			});

			expect(result.isError).toBe(true);

			// Parse the JSON response
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.success).toBe(false);
			expect(parsed.error.code).toBe('VALIDATION_ERROR');
			expect(parsed.error.type).toBe('ValidationError');
			expect(parsed.error.message).toContain('binary or control characters');
			expect(parsed.error.recoverable).toBe(true);
			expect(parsed.error.guidance).toContain(
				'Ensure code is valid UTF-8 text',
			);
			expect(result.structuredContent).toEqual({
				success: false,
				error: expect.stringContaining('binary or control'),
			});

			// Should not call runtime.execute
			expect(mockRuntime.execute).not.toHaveBeenCalled();
		});

		it('should reject code with other control characters', async () => {
			// Code with backspace character (\x08)
			const codeWithBackspace = 'return 1;\x08';

			const result = await registeredHandler({
				code: codeWithBackspace,
			});

			expect(result.isError).toBe(true);
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.error.code).toBe('VALIDATION_ERROR');
			expect(parsed.error.message).toContain('binary or control characters');
		});

		it('should allow code with common whitespace characters', async () => {
			// Code with tabs, newlines, and carriage returns (should be allowed)
			const codeWithWhitespace = 'const x = 1;\n\treturn x;\r\n';

			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: 1,
			});
			mockRuntime.formatResult.mockReturnValue('{"success":true,"result":1}');

			const result = await registeredHandler({
				code: codeWithWhitespace,
			});

			// Should call runtime.execute since whitespace is allowed
			expect(mockRuntime.execute).toHaveBeenCalled();
			expect(result.isError).toBeUndefined();
		});

		it('should validate size before binary character check', async () => {
			// Large code with binary character - should fail on size first
			const largeCodeWithBinary = 'a'.repeat(100 * 1024 + 1) + '\x00';

			const result = await registeredHandler({
				code: largeCodeWithBinary,
			});

			expect(result.isError).toBe(true);
			const parsed = JSON.parse(result.content[0].text);
			// Should be size error, not binary error (size is checked first)
			expect(parsed.error.message).toContain('exceeds maximum allowed');
		});
	});

	describe('structured error responses', () => {
		it('should return structured JSON for runtime structuredError', async () => {
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

			mockRuntime.execute.mockResolvedValue({
				success: false,
				error: 'Authentication failed',
				structuredError,
				executionTime: 10,
			});

			const result = await registeredHandler({
				code: 'return await api.searchSymbols({});',
			});

			expect(result.isError).toBe(true);
			expect(result.content).toHaveLength(1);
			expect(result.content[0].type).toBe('text');

			// Parse the JSON response
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.success).toBe(false);
			expect(parsed.error.code).toBe('AUTH_ERROR');
			expect(parsed.error.type).toBe('AuthenticationError');
			expect(result.structuredContent).toEqual({
				success: false,
				error: 'Invalid API key',
			});
		});

		it('should include error.code in structured JSON response', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'PROJECT_NOT_INDEXED' as const,
					type: 'NotFoundError',
					message: 'Project not found',
					recoverable: true,
					guidance: ['Run: constellation index'],
				},
				formattedMessage: 'Project not indexed',
			};

			mockRuntime.execute.mockResolvedValue({
				success: false,
				error: 'Project not indexed',
				structuredError,
				executionTime: 10,
			});

			const result = await registeredHandler({
				code: 'return await api.searchSymbols({});',
			});

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.error.code).toBe('PROJECT_NOT_INDEXED');
		});

		it('should include guidance array in structured JSON response', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'NOT_CONFIGURED' as const,
					type: 'ConfigurationError',
					message: 'constellation.json not found',
					recoverable: true,
					guidance: [
						'Run: constellation init',
						'Run: constellation auth',
						'Run: constellation index',
					],
				},
				formattedMessage: 'Configuration error',
			};

			mockRuntime.execute.mockResolvedValue({
				success: false,
				error: 'Configuration error',
				structuredError,
				executionTime: 5,
			});

			const result = await registeredHandler({
				code: 'return 42;',
			});

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.error.guidance).toHaveLength(3);
			expect(parsed.error.guidance).toContain('Run: constellation init');
		});

		it('should include context in structured JSON response when present', async () => {
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

			mockRuntime.execute.mockResolvedValue({
				success: false,
				error: 'Authentication failed',
				structuredError,
				executionTime: 10,
			});

			const result = await registeredHandler({
				code: 'return await api.searchSymbols({});',
			});

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.error.context).toBeDefined();
			expect(parsed.error.context.projectId).toBe('test-project');
		});

		it('should set isError: true for structuredError responses', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'EXECUTION_ERROR' as const,
					type: 'Error',
					message: 'Execution failed',
					recoverable: false,
					guidance: [],
				},
				formattedMessage: 'Execution error',
			};

			mockRuntime.execute.mockResolvedValue({
				success: false,
				error: 'Execution failed',
				structuredError,
				executionTime: 10,
			});

			const result = await registeredHandler({
				code: 'throw new Error("test");',
			});

			expect(result.isError).toBe(true);
		});

		it('should include formattedMessage in structured JSON response', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'API_UNREACHABLE' as const,
					type: 'Error',
					message: 'ECONNREFUSED',
					recoverable: true,
					guidance: ['Check if the API server is running'],
				},
				formattedMessage:
					'API server is unreachable. Check if constellation-core is running.',
			};

			mockRuntime.execute.mockResolvedValue({
				success: false,
				error: 'ECONNREFUSED',
				structuredError,
				executionTime: 50,
			});

			const result = await registeredHandler({
				code: 'return await api.searchSymbols({});',
			});

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.formattedMessage).toContain('API server is unreachable');
		});

		it('should include recoverable flag in structured JSON response', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'TOOL_NOT_FOUND' as const,
					type: 'ToolNotFoundError',
					message: 'Tool not found',
					recoverable: false,
					guidance: ['Check tool name spelling'],
				},
				formattedMessage: 'Tool not found',
			};

			mockRuntime.execute.mockResolvedValue({
				success: false,
				error: 'Tool not found',
				structuredError,
				executionTime: 10,
			});

			const result = await registeredHandler({
				code: 'return await api.nonExistentTool({});',
			});

			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.error.recoverable).toBe(false);
		});

		it('should return structured JSON for config initialization error', async () => {
			// Import the mocked configCache
			const { configCache } =
				await import('../../../src/config/config-cache.js');

			// Mock configCache to return config with initialization error
			(configCache.getDefaultConfig as jest.Mock).mockReturnValue({
				config: {
					apiUrl: 'http://localhost:3000',
					branch: '',
					languages: {},
					projectId: '',
				},
				projectId: '',
				branchName: '',
				apiKey: '',
				configLoaded: false,
				gitRoot: '/test/project',
				initializationError: 'constellation.json not found',
			});

			// Re-register tool with error config
			const newServer = {
				registerTool: jest.fn((name, config, handler) => {
					registeredHandler = handler;
				}),
			} as any;
			registerQueryCodeGraphTool(newServer);

			const result = await registeredHandler({
				code: 'return 42;',
			});

			expect(result.isError).toBe(true);

			// Parse the JSON response
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.success).toBe(false);
			expect(parsed.error.code).toBe('NOT_CONFIGURED');
			expect(parsed.error.type).toBe('ConfigurationError');
			expect(parsed.error.recoverable).toBe(true);
			expect(result.structuredContent).toEqual({
				success: false,
				error: expect.any(String),
			});

			// Restore original mock
			(configCache.getDefaultConfig as jest.Mock).mockReturnValue({
				config: {
					apiUrl: 'http://localhost:3000',
					branch: 'test-branch',
					languages: { typescript: { fileExtensions: ['.ts'] } },
					projectId: 'test-project',
				},
				projectId: 'test-project',
				branchName: 'test-branch',
				apiKey: 'test-key',
				configLoaded: true,
				gitRoot: '/test/project',
			});
		});

		it('should return structured JSON for caught exceptions', async () => {
			mockRuntime.execute.mockRejectedValue(new Error('Unexpected error'));

			const result = await registeredHandler({
				code: 'throw new Error("test");',
			});

			expect(result.isError).toBe(true);

			// Parse the JSON response
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.success).toBe(false);
			expect(parsed.error.code).toBeDefined();
			expect(parsed.error.type).toBe('ExecutionError');
			expect(parsed.error.message).toContain('Unexpected error');
			expect(result.structuredContent).toEqual({
				success: false,
				error: expect.stringContaining('Unexpected error'),
			});
		});

		it('should return flat SchemaCompliantOutput in structuredContent, not full McpErrorResponse', async () => {
			const structuredError = {
				success: false as const,
				error: {
					code: 'AUTH_ERROR' as const,
					type: 'AuthenticationError',
					message: 'Invalid API key',
					recoverable: true,
					guidance: ['Run: constellation auth'],
					context: {
						tool: 'code_intel',
						projectId: 'test-project',
						branchName: 'main',
					},
					docs: 'https://docs.example.com/auth',
				},
				formattedMessage: 'Authentication failed - check your key',
			};

			mockRuntime.execute.mockResolvedValue({
				success: false,
				error: 'Authentication failed',
				structuredError,
				executionTime: 10,
			});

			const result = await registeredHandler({
				code: 'return await api.searchSymbols({});',
			});

			// structuredContent should be flat SchemaCompliantOutput, not nested McpErrorResponse
			expect(result.structuredContent).toEqual({
				success: false,
				error: 'Invalid API key',
			});
			// Should NOT contain nested error object properties
			expect(result.structuredContent.error).toBe('Invalid API key');
			expect(typeof result.structuredContent.error).toBe('string');

			// Full error details remain in text content for backwards compatibility
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed.error.code).toBe('AUTH_ERROR');
			expect(parsed.error.guidance).toContain('Run: constellation auth');
			expect(parsed.error.context.projectId).toBe('test-project');
			expect(parsed.formattedMessage).toBe(
				'Authentication failed - check your key',
			);
		});
	});
});
