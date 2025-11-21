/**
 * CodeModeSandbox Unit Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CodeModeSandbox } from '../../../src/code-mode/sandbox.js';
import { ConstellationClient } from '../../../src/client/constellation-client.js';

// Mock dependencies
jest.mock('../../../src/client/constellation-client.js');
jest.mock('../../../src/config/config-manager.js', () => ({
	getConfigContext: jest.fn(() => ({
		projectId: 'test-project',
		branchName: 'test-branch',
		namespace: 'test-namespace',
		config: { apiUrl: 'http://test-api.com' },
		apiKey: 'test-api-key',
		initializationError: null,
	})),
}));

const MockedConstellationClient = ConstellationClient as jest.MockedClass<typeof ConstellationClient>;

describe('CodeModeSandbox', () => {
	let sandbox: CodeModeSandbox;
	let mockClient: jest.Mocked<ConstellationClient>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockClient = {
			executeMcpTool: jest.fn(),
		} as any;

		MockedConstellationClient.mockImplementation(() => mockClient);

		sandbox = new CodeModeSandbox({
			timeout: 5000,
			allowConsole: true,
		});
	});

	// Helper function to create mock McpToolResult
	const createMockResult = <T>(data: T, success = true, error?: string) => ({
		success,
		data: success ? data : undefined,
		error: error || undefined,
		metadata: {
			toolName: 'test_tool',
			executionTime: 10,
			cached: false,
			timestamp: new Date().toISOString(),
		},
	});

	describe('constructor', () => {
		it('should create sandbox with default options', () => {
			const s = new CodeModeSandbox();
			expect(MockedConstellationClient).toHaveBeenCalled();
		});

		it('should create sandbox with custom timeout', () => {
			new CodeModeSandbox({ timeout: 10000 });
			expect(MockedConstellationClient).toHaveBeenCalled();
		});

		it('should create sandbox with allowConsole = false', () => {
			new CodeModeSandbox({ allowConsole: false });
			expect(MockedConstellationClient).toHaveBeenCalled();
		});

		it('should create ConstellationClient with config context', () => {
			new CodeModeSandbox();

			expect(MockedConstellationClient).toHaveBeenCalledWith(
				expect.objectContaining({
					apiUrl: 'http://test-api.com',
				}),
				'test-api-key'
			);
		});
	});

	describe('execute', () => {
		it('should execute simple synchronous code', async () => {
			const code = 'return 42;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(42);
			expect(result.executionTime).toBeGreaterThan(0);
		});

		it('should execute code with return value', async () => {
			const code = 'return { message: "hello" };';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual({ message: 'hello' });
		});

		it('should execute code with mathematical operations', async () => {
			const code = 'return 2 + 2 * 3;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(8);
		});

		it('should execute code with array operations', async () => {
			const code = 'return [1, 2, 3].map(x => x * 2);';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual([2, 4, 6]);
		});

		it('should execute code with object operations', async () => {
			const code = 'const obj = { a: 1, b: 2 }; return obj.a + obj.b;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(3);
		});

		it('should execute code with JSON operations', async () => {
			const code = 'return JSON.stringify({ test: "data" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe('{"test":"data"}');
		});

		it('should capture console.log output', async () => {
			const code = 'console.log("test message"); return 1;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs).toContain('test message');
		});

		it('should capture console.error output', async () => {
			const code = 'console.error("error message"); return 1;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs).toContain('[ERROR] error message');
		});

		it('should capture console.warn output', async () => {
			const code = 'console.warn("warning"); return 1;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs).toContain('[WARN] warning');
		});

		it('should capture console.info output', async () => {
			const code = 'console.info("info"); return 1;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs).toContain('[INFO] info');
		});

		it('should capture multiple console outputs', async () => {
			const code = 'console.log("a"); console.log("b"); return 1;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['a', 'b']);
		});

		it('should handle console.log with objects', async () => {
			const code = 'console.log({ key: "value" }); return 1;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs![0]).toContain('"key"');
			expect(result.logs![0]).toContain('"value"');
		});

		it('should handle errors gracefully', async () => {
			const code = 'throw new Error("test error");';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('test error');
			expect(result.executionTime).toBeGreaterThanOrEqual(0);
		});

		it('should handle syntax errors', async () => {
			const code = 'this is invalid syntax}}}';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should handle undefined references', async () => {
			const code = 'return nonExistentVariable;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('nonExistentVariable');
		});

		it('should wrap code in async IIFE', async () => {
			const code = 'const x = 1; return x;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(1);
		});

		it('should not double-wrap async functions', async () => {
			const code = 'async function test() { return 42; }';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
		});

		it('should measure execution time', async () => {
			const code = 'let sum = 0; for(let i = 0; i < 1000; i++) sum += i; return sum;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.executionTime).toBeGreaterThanOrEqual(0);
			expect(result.executionTime).toBeLessThan(1000);
		});
	});

	describe('API proxy', () => {
		it('should call API methods through proxy', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult({ symbols: [{ name: 'test' }] })
			);

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
				'search_symbols',
				{ query: 'test' },
				{
					projectId: 'test-project',
					branchName: 'test-branch',
				}
			);
			expect(result.result).toEqual({ symbols: [{ name: 'test' }] });
		});

		it('should convert camelCase to snake_case for tool names', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult({ details: 'test' })
			);

			const code = 'return await api.getSymbolDetails({ symbolId: "123" });';
			await sandbox.execute(code);

			expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
				'get_symbol_details',
				{ symbolId: '123' },
				expect.any(Object)
			);
		});

		it('should handle API errors', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult(undefined, false, 'API error')
			);

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('API error');
		});

		it('should handle API call with multiple parameters', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult({ symbols: [] })
			);

			const code = 'return await api.searchSymbols({ query: "test", limit: 10, types: ["class"] });';
			await sandbox.execute(code);

			expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
				'search_symbols',
				{ query: 'test', limit: 10, types: ['class'] },
				expect.any(Object)
			);
		});
	});

	describe('validateCode', () => {
		it('should accept valid safe code', () => {
			const code = 'return 42;';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
			expect(result.errors).toBeUndefined();
		});

		it('should reject code with require()', () => {
			const code = 'const fs = require("fs");';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Dangerous pattern detected: require\\s*\\(');
		});

		it('should reject code with import', () => {
			const code = 'import fs from "fs";';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('import');
		});

		it('should reject code with eval()', () => {
			const code = 'eval("malicious code");';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('eval');
		});

		it('should reject code with Function constructor', () => {
			const code = 'new Function("return 1")();';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('Function');
		});

		it('should reject code with __proto__', () => {
			const code = 'obj.__proto__ = {};';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('__proto__');
		});

		it('should reject code accessing process', () => {
			const code = 'process.exit(1);';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('process');
		});

		it('should reject code with child_process', () => {
			const code = 'const child_process = {};';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('child_process');
		});

		it('should reject code with fs module access', () => {
			const code = 'fs.readFile("file.txt");';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('fs');
		});

		it('should reject code with net module', () => {
			const code = 'net.connect(8080);';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('net');
		});

		it('should reject code with http module', () => {
			const code = 'http.get("url");';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('http');
		});

		it('should reject infinite while loop', () => {
			const code = 'while(true) {}';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('while(true)');
		});

		it('should reject infinite for loop', () => {
			const code = 'for(;;) {}';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors![0]).toContain('for(;;)');
		});

		it('should report multiple errors', () => {
			const code = 'require("fs"); eval("code"); while(true) {}';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors).toHaveLength(3);
		});

		it('should accept code with safe loops', () => {
			const code = 'for(let i = 0; i < 10; i++) {}';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
		});

		it('should accept code with while loop with condition', () => {
			const code = 'let i = 0; while(i < 10) { i++; }';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
		});
	});

	describe('sandbox security', () => {
		it('should not allow access to Node.js globals', async () => {
			const code = 'return typeof require;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe('undefined');
		});

		it('should not allow setTimeout when disabled', async () => {
			const s = new CodeModeSandbox({ allowTimers: false });
			const code = 'return typeof setTimeout;';
			const result = await s.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe('undefined');
		});

		it('should allow setTimeout when enabled', async () => {
			const s = new CodeModeSandbox({ allowTimers: true });
			const code = 'return typeof setTimeout;';
			const result = await s.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe('function');
		});

		it('should not add console methods to sandbox when disabled', async () => {
			// Note: VM context isolation may not completely remove console
			// This test verifies console is not explicitly added to sandbox
			const s = new CodeModeSandbox({ allowConsole: false });
			const code = 'try { console.log("test"); return "logged"; } catch(e) { return "no console"; }';
			const result = await s.execute(code);

			expect(result.success).toBe(true);
			// Console either doesn't work or doesn't log to our logs array
			expect(result.logs).toEqual([]);
		});

		it('should provide standard JavaScript globals', async () => {
			const code = 'return [typeof Promise, typeof Array, typeof Object, typeof JSON];';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual(['function', 'function', 'function', 'object']);
		});

		it('should provide Math object', async () => {
			const code = 'return Math.max(1, 2, 3);';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(3);
		});

		it('should provide Date object', async () => {
			const code = 'return typeof new Date();';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe('object');
		});

		it('should provide RegExp', async () => {
			const code = 'return /test/.test("testing");';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(true);
		});

		it('should provide Map and Set', async () => {
			const code = 'const m = new Map(); const s = new Set(); return [typeof m, typeof s];';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual(['object', 'object']);
		});
	});

	describe('timeout handling', () => {
		it('should timeout long-running code', async () => {
			const s = new CodeModeSandbox({ timeout: 100 });
			// Infinite loop that should timeout
			const code = 'let i = 0; while(i >= 0) { i++; }';
			const result = await s.execute(code);

			expect(result.success).toBe(false);
			// Timeout error message varies by Node version
			expect(result.error).toBeDefined();
			expect(result.error!.toLowerCase()).toMatch(/timeout|timed out/);
		}, 10000);

		it('should not timeout fast code', async () => {
			const s = new CodeModeSandbox({ timeout: 1000 });
			const code = 'return 42;';
			const result = await s.execute(code);

			expect(result.success).toBe(true);
			expect(result.executionTime).toBeLessThan(1000);
		});

		it('should include timeout value in error message', async () => {
			const s = new CodeModeSandbox({ timeout: 50 });
			const code = 'let i = 0; while(i >= 0) { i++; }';
			const result = await s.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('50');
		}, 5000);
	});

	describe('error formatting', () => {
		it('should format standard Error messages', async () => {
			const code = 'throw new Error("Custom error message");';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Custom error message');
		});

		it('should format non-Error throws as strings', async () => {
			const code = 'throw "String error";';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toBe('String error');
		});
	});
});
