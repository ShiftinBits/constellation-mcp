/**
 * Execute Code Tool Registration Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerExecuteCodeTool } from '../../../src/tools/execute-code-tool.js';
import { CodeModeRuntime } from '../../../src/code-mode/runtime.js';

// Mock dependencies
jest.mock('../../../src/code-mode/runtime.js');
jest.mock('../../../src/config/config-manager.js', () => ({
	getConfigContext: jest.fn(() => ({
		projectId: 'test-project',
		branchName: 'test-branch',
		namespace: 'test-namespace',
		accessKey: 'test-key',
		initializationError: null,
	})),
}));

const MockedCodeModeRuntime = CodeModeRuntime as jest.MockedClass<typeof CodeModeRuntime>;

describe('registerExecuteCodeTool', () => {
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
		registerExecuteCodeTool(mockServer);
	});

	describe('tool registration', () => {
		it('should register execute_code tool with server', () => {
			expect(mockServer.registerTool).toHaveBeenCalledWith(
				'execute_code',
				expect.objectContaining({
					title: expect.stringContaining('Execute TypeScript Code'),
					description: expect.stringContaining('THE ONLY AVAILABLE TOOL'),
				}),
				expect.any(Function)
			);
		});

		it('should register with correct input schema', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];

			expect(config.inputSchema.code).toBeDefined();
			expect(config.inputSchema.language).toBeDefined();
			expect(config.inputSchema.timeout).toBeDefined();
		});

		it('should register with correct output schema', () => {
			const call = mockServer.registerTool.mock.calls[0];
			const config = call[1];

			expect(config.outputSchema.success).toBeDefined();
			expect(config.outputSchema.result).toBeDefined();
			expect(config.outputSchema.logs).toBeDefined();
			expect(config.outputSchema.time).toBeDefined();
			expect(config.outputSchema.error).toBeDefined();
		});
	});

	describe('tool handler', () => {
		it('should execute TypeScript code successfully', async () => {
			const mockResponse = {
				success: true,
				result: 42,
				logs: ['test log'],
				executionTime: 100,
			};

			mockRuntime.execute.mockResolvedValue(mockResponse);
			mockRuntime.formatResult.mockReturnValue(JSON.stringify(mockResponse, null, 2));

			const result = await registeredHandler({
				code: 'return 42;',
				language: 'typescript',
				timeout: 5000,
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0].type).toBe('text');
			expect(result.content[0].text).toContain('"success": true');
			expect(result.structuredContent).toEqual(mockResponse);
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
				language: 'typescript',
				timeout: 10000,
			});

			expect(MockedCodeModeRuntime).toHaveBeenCalledWith({
				timeout: 10000,
				allowConsole: true,
				allowTimers: false,
			});
		});

		it('should use default timeout when not provided', async () => {
			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: null,
			});
			mockRuntime.formatResult.mockReturnValue('{}');

			await registeredHandler({
				code: 'return 1;',
				language: 'typescript',
			});

			expect(MockedCodeModeRuntime).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 30000,
				})
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
				language: 'typescript',
				timeout: 5000,
			});

			expect(mockRuntime.execute).toHaveBeenCalledWith({
				code,
				language: 'typescript',
				timeout: 5000,
			});
		});

		it('should handle JavaScript language', async () => {
			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: null,
			});
			mockRuntime.formatResult.mockReturnValue('{}');

			await registeredHandler({
				code: 'return 1;',
				language: 'javascript',
			});

			expect(mockRuntime.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					language: 'javascript',
				})
			);
		});

		it('should default to typescript when language not specified', async () => {
			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: null,
			});
			mockRuntime.formatResult.mockReturnValue('{}');

			await registeredHandler({
				code: 'return 1;',
			});

			expect(mockRuntime.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					language: 'typescript',
				})
			);
		});

		it('should handle execution errors', async () => {
			const error = new Error('Execution failed');
			mockRuntime.execute.mockRejectedValue(error);

			const result = await registeredHandler({
				code: 'throw new Error("test");',
				language: 'typescript',
			});

			expect(result.content[0].type).toBe('text');
			expect(result.content[0].text).toContain('"success": false');
			expect(result.content[0].text).toContain('Execution failed');
			expect(result.isError).toBe(true);
		});

		it('should handle non-Error exceptions', async () => {
			mockRuntime.execute.mockRejectedValue('String error');

			const result = await registeredHandler({
				code: 'throw "error";',
				language: 'typescript',
			});

			expect(result.content[0].text).toContain('"success": false');
			expect(result.content[0].text).toContain('String error');
			expect(result.isError).toBe(true);
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
				language: 'typescript',
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
				language: 'typescript',
			});

			expect(result.structuredContent.executionTime).toBe(250);
		});
	});

	describe('configuration error handling', () => {
		it('should return setup instructions when config has initialization error', async () => {
			// Re-mock getConfigContext to return error
			const { getConfigContext } = await import('../../../src/config/config-manager.js');
			(getConfigContext as jest.Mock).mockReturnValue({
				projectId: '',
				branchName: '',
				namespace: '',
				accessKey: '',
				initializationError: 'Configuration file not found',
			});

			// Re-register tool with error config
			const newServer = {
				registerTool: jest.fn((name, config, handler) => {
					registeredHandler = handler;
				}),
			} as any;
			registerExecuteCodeTool(newServer);

			const result = await registeredHandler({
				code: 'return 42;',
				language: 'typescript',
			});

			expect(result.isError).toBe(true);
			expect(result.content[0].text.toLowerCase()).toContain('configuration');
			expect(mockRuntime.execute).not.toHaveBeenCalled();

			// Restore original mock
			(getConfigContext as jest.Mock).mockReturnValue({
				projectId: 'test-project',
				branchName: 'test-branch',
				namespace: 'test-namespace',
				accessKey: 'test-key',
				initializationError: null,
			});
		});
	});

	describe('response format', () => {
		it('should return content with text type', async () => {
			mockRuntime.execute.mockResolvedValue({
				success: true,
				result: 'test',
			});
			mockRuntime.formatResult.mockReturnValue('{"success":true,"result":"test"}');

			const result = await registeredHandler({
				code: 'return "test";',
				language: 'typescript',
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
				language: 'typescript',
			});

			expect(result.structuredContent).toBeDefined();
			expect(result.structuredContent).toEqual(response);
		});

		it('should not include structured content for errors', async () => {
			mockRuntime.execute.mockRejectedValue(new Error('Test error'));

			const result = await registeredHandler({
				code: 'throw new Error();',
				language: 'typescript',
			});

			expect(result.structuredContent).toBeUndefined();
			expect(result.isError).toBe(true);
		});
	});
});
