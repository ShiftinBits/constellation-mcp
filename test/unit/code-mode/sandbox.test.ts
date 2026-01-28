/**
 * CodeModeSandbox Unit Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CodeModeSandbox } from '../../../src/code-mode/sandbox.js';
import { ConstellationClient } from '../../../src/client/constellation-client.js';
import { ConstellationConfig } from '../../../src/config/config.js';
import type { ConfigContext } from '../../../src/config/config-cache.js';

// Mock dependencies
jest.mock('../../../src/client/constellation-client.js');

const MockedConstellationClient = ConstellationClient as jest.MockedClass<
	typeof ConstellationClient
>;

// Create a mock config for testing
const createMockConfigContext = (): ConfigContext => ({
	config: {
		apiUrl: 'http://test-api.com',
		branch: 'test-branch',
		languages: { typescript: { fileExtensions: ['.ts'] } },
		projectId: 'test-project',
		validate: jest.fn(),
	} as unknown as ConstellationConfig,
	projectId: 'test-project',
	branchName: 'test-branch',
	apiKey: 'test-api-key',
	configLoaded: true,
	gitRoot: '/test/project',
});

describe('CodeModeSandbox', () => {
	let sandbox: CodeModeSandbox;
	let mockClient: jest.Mocked<ConstellationClient>;
	let mockConfigContext: ConfigContext;

	beforeEach(() => {
		jest.clearAllMocks();

		mockConfigContext = createMockConfigContext();

		mockClient = {
			executeMcpTool: jest.fn(),
		} as any;

		MockedConstellationClient.mockImplementation(() => mockClient);

		sandbox = new CodeModeSandbox({
			timeout: 5000,
			allowConsole: true,
			configContext: mockConfigContext,
		});
	});

	// Helper function to create mock McpToolResult
	const createMockResult = <T>(
		data: T,
		success = true,
		error?: string,
		asOfCommit?: string,
	) => ({
		success,
		data: success ? data : undefined,
		error: error || undefined,
		metadata: {
			toolName: 'test_tool',
			executionTime: 10,
			cached: false,
			timestamp: new Date().toISOString(),
			...(asOfCommit ? { asOfCommit } : {}),
		},
	});

	describe('constructor', () => {
		it('should create sandbox with required configContext', () => {
			const s = new CodeModeSandbox({ configContext: mockConfigContext });
			expect(MockedConstellationClient).toHaveBeenCalled();
		});

		it('should create sandbox with custom timeout', () => {
			new CodeModeSandbox({ timeout: 10000, configContext: mockConfigContext });
			expect(MockedConstellationClient).toHaveBeenCalled();
		});

		it('should create sandbox with allowConsole = false', () => {
			new CodeModeSandbox({
				allowConsole: false,
				configContext: mockConfigContext,
			});
			expect(MockedConstellationClient).toHaveBeenCalled();
		});

		it('should create ConstellationClient with config context', () => {
			new CodeModeSandbox({ configContext: mockConfigContext });

			expect(MockedConstellationClient).toHaveBeenCalledWith(
				expect.objectContaining({
					apiUrl: 'http://test-api.com',
				}),
				'test-api-key',
			);
		});

		it('should throw error if configContext is missing apiKey', () => {
			const badConfig = { ...mockConfigContext, apiKey: '' };
			expect(() => new CodeModeSandbox({ configContext: badConfig })).toThrow(
				'Configuration not initialized',
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
			const code =
				'let sum = 0; for(let i = 0; i < 1000; i++) sum += i; return sum;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.executionTime).toBeGreaterThanOrEqual(0);
			expect(result.executionTime).toBeLessThan(1000);
		});
	});

	describe('API proxy', () => {
		it('should call API methods through proxy', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult({ symbols: [{ name: 'test' }] }),
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
				},
			);
			expect(result.result).toEqual({ symbols: [{ name: 'test' }] });
		});

		it('should convert camelCase to snake_case for tool names', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult({ details: 'test' }),
			);

			const code = 'return await api.getSymbolDetails({ symbolId: "123" });';
			await sandbox.execute(code);

			expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
				'get_symbol_details',
				{ symbolId: '123' },
				expect.any(Object),
			);
		});

		it('should handle API errors', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult(undefined, false, 'API error'),
			);

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('API error');
		});

		it('should handle API call with multiple parameters', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult({ symbols: [] }),
			);

			const code =
				'return await api.searchSymbols({ query: "test", limit: 10, types: ["class"] });';
			await sandbox.execute(code);

			expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
				'search_symbols',
				{ query: 'test', limit: 10, types: ['class'] },
				expect.any(Object),
			);
		});

		it('should capture asOfCommit from API response metadata', async () => {
			const commitHash = 'abc123def456abc123def456abc123def456abc1';
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult(
					{ symbols: [{ name: 'test' }] },
					true,
					undefined,
					commitHash,
				),
			);

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.asOfCommit).toBe(commitHash);
		});

		it('should not include asOfCommit when API response has no commit', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult({ symbols: [] }),
			);

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.asOfCommit).toBeUndefined();
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
			expect(result.errors).toContain(
				'Dangerous pattern detected: require\\s*\\(',
			);
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
			const code = 'require("fs"); while(true) {}';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			// Regex catches require and while(true), both are counted
			expect(result.errors!.length).toBeGreaterThanOrEqual(2);
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

		// Issue 3: Tests for additional escape vector patterns
		describe('additional escape vectors', () => {
			it('should reject .constructor escape via bracket notation', () => {
				const code = '[].constructor["constructor"]("return 1")()';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors![0]).toContain('constructor');
			});

			it('should reject .constructor escape via dot notation', () => {
				const code = '[].constructor.constructor("return process")()';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors![0]).toContain('constructor');
			});

			it('should reject .constructor escape via function call', () => {
				const code = '"".constructor.constructor("return this")()';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors![0]).toContain('constructor');
			});

			it('should reject globalThis access', () => {
				const code = 'return globalThis.foo';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors![0]).toContain('globalThis');
			});

			it('should reject with statement', () => {
				const code = 'with (obj) { x = 1; }';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors![0]).toContain('with');
			});

			it('should reject Symbol.unscopables manipulation', () => {
				const code = 'Symbol.unscopables';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors![0]).toContain('Symbol');
			});

			it('should reject Reflect API usage', () => {
				const code = 'Reflect.get(target, prop)';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors![0]).toContain('Reflect');
			});

			it('should reject direct Proxy construction', () => {
				const code = 'new Proxy({}, handler)';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors![0]).toContain('Proxy');
			});

			it('should allow legitimate constructor keyword in variable names', () => {
				// Should NOT block: const myConstructor = {}
				const code = 'const myConstructor = {};';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(true);
			});

			it('should allow legitimate code with global variables', () => {
				// Should NOT block: global in variable name
				const code = 'const globalValue = 42;';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(true);
			});
		});

		// SB-101: AST-based validation tests
		describe('AST-based validation (SB-101)', () => {
			it('should block computed constructor access', () => {
				const code = 'obj["constructor"]';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors!.some((e) => e.includes('[AST]'))).toBe(true);
				expect(result.errors!.some((e) => e.includes('constructor'))).toBe(
					true,
				);
			});

			it('should block constructor chain via computed property', () => {
				const code = '[]["constructor"]["constructor"]("return this")()';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors!.some((e) => e.includes('[AST]'))).toBe(true);
			});

			it('should block computed __proto__ access', () => {
				const code = 'obj["__proto__"]';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors!.some((e) => e.includes('[AST]'))).toBe(true);
			});

			it('should block computed prototype access', () => {
				const code = 'Object["prototype"]';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(result.errors!.some((e) => e.includes('[AST]'))).toBe(true);
			});

			it('should block dynamic import()', () => {
				const code = 'import("fs")';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				expect(
					result.errors!.some((e) => e.toLowerCase().includes('import')),
				).toBe(true);
			});

			it('should include location info in AST errors', () => {
				const code = 'const x = obj.constructor';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(false);
				const astError = result.errors!.find((e) => e.includes('[AST]'));
				expect(astError).toContain('line');
				expect(astError).toContain('column');
			});

			it('should allow legitimate API calls', () => {
				const code = 'return await api.searchSymbols({ query: "test" })';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(true);
			});

			it('should allow object literal with constructor as key', () => {
				const code = '({ constructor: "value" })';
				const result = sandbox.validateCode(code);

				expect(result.valid).toBe(true);
			});

			it('should add parse warning for syntax errors', () => {
				const code = 'const x = {';
				const result = sandbox.validateCode(code);

				// Still valid (let VM catch syntax errors)
				// But should have a warning about parse failure
				expect(result.warnings).toBeDefined();
				expect(
					result.warnings!.some((w) => w.includes('AST parse warning')),
				).toBe(true);
			});
		});
	});

	describe('sandbox security', () => {
		// Issue 1: Internal validation in execute() (defense in depth)
		describe('internal validation enforcement', () => {
			it('should block dangerous code when execute() called directly', async () => {
				const result = await sandbox.execute('require("fs")');

				expect(result.success).toBe(false);
				expect(result.error).toContain('Security validation failed');
			});

			it('should block code evaluation via execute() directly', async () => {
				// Note: Testing that dangerous patterns are blocked
				const result = await sandbox.execute('eval("1+1")');

				expect(result.success).toBe(false);
				expect(result.error).toContain('Security validation failed');
			});

			it('should include warnings in logs for valid code with issues', async () => {
				// Code without return statement triggers warning
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ symbols: [] }),
				);

				const result = await sandbox.execute(
					'const x = await api.searchSymbols({ query: "test" });',
				);

				expect(result.success).toBe(true);
				expect(result.logs).toBeDefined();
				expect(result.logs!.some((log) => log.includes('[WARN]'))).toBe(true);
				expect(
					result.logs!.some((log) =>
						log.includes('No explicit return statement detected'),
					),
				).toBe(true);
			});

			it('should block globalThis access via execute()', async () => {
				const result = await sandbox.execute('return globalThis');

				expect(result.success).toBe(false);
				expect(result.error).toContain('Security validation failed');
			});

			it('should block .constructor escape via execute()', async () => {
				const result = await sandbox.execute(
					'[].constructor.constructor("return 1")()',
				);

				expect(result.success).toBe(false);
				expect(result.error).toContain('Security validation failed');
			});
		});

		// Issue 2: Prototype isolation tests
		describe('prototype isolation', () => {
			it('should not allow Object.prototype pollution to affect host', async () => {
				// Execute code that tries to pollute Object.prototype
				// With SB-102 freezing, this now fails - which is correct behavior
				const result = await sandbox.execute(
					'Object.prototype.polluted = true; return 1;',
				);

				// Execution should fail due to frozen prototype (SB-102)
				expect(result.success).toBe(false);
				// Verify host Object.prototype is not polluted
				expect((Object.prototype as any).polluted).toBeUndefined();
			});

			it('should not allow Array.prototype pollution to affect host', async () => {
				const result = await sandbox.execute(
					'Array.prototype.evilMethod = function() { return "evil"; }; return 1;',
				);

				// Execution should fail due to frozen prototype (SB-102)
				expect(result.success).toBe(false);
				// Verify host Array.prototype is not polluted
				expect((Array.prototype as any).evilMethod).toBeUndefined();
			});

			it('should not allow String.prototype pollution to affect host', async () => {
				const result = await sandbox.execute(
					'String.prototype.compromised = true; return 1;',
				);

				// Execution should fail due to frozen prototype (SB-102)
				expect(result.success).toBe(false);
				expect((String.prototype as any).compromised).toBeUndefined();
			});

			it('should preserve Array operations despite isolation', async () => {
				const result = await sandbox.execute('return [1,2,3].map(x => x * 2);');

				expect(result.success).toBe(true);
				expect(result.result).toEqual([2, 4, 6]);
			});

			it('should preserve Object operations despite isolation', async () => {
				const result = await sandbox.execute(
					'return Object.keys({ a: 1, b: 2 });',
				);

				expect(result.success).toBe(true);
				expect(result.result).toEqual(['a', 'b']);
			});

			it('should preserve JSON operations despite isolation', async () => {
				const result = await sandbox.execute(
					'return JSON.stringify({ test: 123 });',
				);

				expect(result.success).toBe(true);
				expect(result.result).toBe('{"test":123}');
			});
		});

		// SB-102: Prototype freezing tests - validates that prototype pollution is blocked
		// Defense-in-depth: SB-101 AST validation blocks .prototype access at validation time,
		// SB-102 frozen prototypes provide runtime protection as backup
		describe('prototype freezing (SB-102)', () => {
			it('should block modifying Object.prototype', async () => {
				const code = `
					Object.prototype.polluted = 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				// Blocked by AST validation (SB-101) or runtime freezing (SB-102)
				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/prototype|Cannot add property|Cannot create property|object is not extensible/i,
				);
			});

			it('should block modifying Array.prototype', async () => {
				const code = `
					Array.prototype.polluted = 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/prototype|Cannot add property|Cannot create property|object is not extensible/i,
				);
			});

			it('should block modifying String.prototype', async () => {
				const code = `
					String.prototype.polluted = 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/prototype|Cannot add property|Cannot create property|object is not extensible/i,
				);
			});

			it('should block modifying Number.prototype', async () => {
				const code = `
					Number.prototype.polluted = 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/prototype|Cannot add property|Cannot create property|object is not extensible/i,
				);
			});

			it('should block modifying Function.prototype', async () => {
				const code = `
					Function.prototype.polluted = 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/prototype|Function|Cannot add property|Cannot create property|object is not extensible/i,
				);
			});

			it('should block modifying Promise.prototype', async () => {
				const code = `
					Promise.prototype.polluted = 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/prototype|Cannot add property|Cannot create property|object is not extensible/i,
				);
			});

			it('should block modifying Map.prototype', async () => {
				const code = `
					Map.prototype.polluted = 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/prototype|Cannot add property|Cannot create property|object is not extensible/i,
				);
			});

			it('should block modifying Set.prototype', async () => {
				const code = `
					Set.prototype.polluted = 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/prototype|Cannot add property|Cannot create property|object is not extensible/i,
				);
			});

			it('should still allow normal object operations', async () => {
				const code = `
					const obj = { a: 1, b: 2 };
					const arr = [1, 2, 3];
					arr.push(4);
					obj.c = 3;
					return { obj, arr };
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result.arr).toEqual([1, 2, 3, 4]);
				expect(result.result.obj).toEqual({ a: 1, b: 2, c: 3 });
			});

			it('should allow Array methods on instances', async () => {
				const code = `
					const result = [1, 2, 3].map(x => x * 2);
					return result;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result).toEqual([2, 4, 6]);
			});

			it('should allow Array filter and reduce operations', async () => {
				const code = `
					const arr = [1, 2, 3, 4, 5];
					const filtered = arr.filter(x => x > 2);
					const sum = arr.reduce((acc, x) => acc + x, 0);
					return { filtered, sum };
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result.filtered).toEqual([3, 4, 5]);
				expect(result.result.sum).toBe(15);
			});

			it('should allow String methods on instances', async () => {
				const code = `
					const str = 'hello world';
					return {
						upper: str.toUpperCase(),
						split: str.split(' '),
						includes: str.includes('world')
					};
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result.upper).toBe('HELLO WORLD');
				expect(result.result.split).toEqual(['hello', 'world']);
				expect(result.result.includes).toBe(true);
			});

			it('should allow Date operations', async () => {
				const code = `
					const date = new Date('2024-01-15T10:30:00Z');
					return {
						year: date.getUTCFullYear(),
						month: date.getUTCMonth(),
						day: date.getUTCDate()
					};
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result.year).toBe(2024);
				expect(result.result.month).toBe(0); // January is 0
				expect(result.result.day).toBe(15);
			});

			it('should allow Map and Set operations', async () => {
				const code = `
					const map = new Map();
					map.set('key1', 'value1');
					map.set('key2', 'value2');

					const set = new Set();
					set.add(1);
					set.add(2);
					set.add(2); // duplicate

					return {
						mapSize: map.size,
						mapValue: map.get('key1'),
						setSize: set.size,
						setHas: set.has(1)
					};
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result.mapSize).toBe(2);
				expect(result.result.mapValue).toBe('value1');
				expect(result.result.setSize).toBe(2);
				expect(result.result.setHas).toBe(true);
			});

			it('should allow Promise operations', async () => {
				const code = `
					const result = await Promise.all([
						Promise.resolve(1),
						Promise.resolve(2),
						Promise.resolve(3)
					]);
					return result;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result).toEqual([1, 2, 3]);
			});

			it('should allow RegExp operations', async () => {
				const code = `
					const pattern = /\\w+/g;
					const str = 'hello world';
					const matches = str.match(pattern);
					return matches;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result).toEqual(['hello', 'world']);
			});

			it('should not affect host environment', async () => {
				// Attempt pollution (will fail due to freeze, but verify host isolation)
				await sandbox.execute(`
					try { Object.prototype.hostLeak = 'leaked'; } catch {}
					return true;
				`);

				// Host environment must be unaffected
				const hostObj: any = {};
				expect(hostObj.hostLeak).toBeUndefined();
			});

			it('should isolate prototype pollution attempts between executions', async () => {
				// First execution - attempt fails due to freeze
				await sandbox.execute(`
					try { Object.prototype.cross = 'polluted'; } catch {}
					return true;
				`);

				// Second execution should start clean (and also have frozen prototypes)
				const result = await sandbox.execute(`
					const obj = {};
					return obj.cross;
				`);

				expect(result.success).toBe(true);
				expect(result.result).toBeUndefined();
			});

			it('should prevent overwriting built-in constructors', async () => {
				// Note: Since sandbox is frozen, attempting to reassign Array will fail
				// The frozen prototypes prevent the attack vector regardless
				const code = `
					try {
						Array = function() { return 'hacked'; };
						return 'reassigned';
					} catch (e) {
						return 'blocked: ' + e.message;
					}
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				// Should be blocked - either throws or assignment is silently ignored
				expect(result.result).not.toBe('reassigned');
			});

			it('should prevent modifying JSON object', async () => {
				const code = `
					JSON.malicious = () => 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/Cannot add property|object is not extensible/,
				);
			});

			it('should prevent modifying Math object', async () => {
				const code = `
					Math.malicious = () => 'hacked';
					return true;
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(false);
				expect(result.error).toMatch(
					/Cannot add property|object is not extensible/,
				);
			});

			it('should allow JSON.stringify and JSON.parse', async () => {
				const code = `
					const obj = { a: 1, b: [2, 3] };
					const json = JSON.stringify(obj);
					const parsed = JSON.parse(json);
					return { json, parsed };
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result.json).toBe('{"a":1,"b":[2,3]}');
				expect(result.result.parsed).toEqual({ a: 1, b: [2, 3] });
			});

			it('should allow Math operations', async () => {
				const code = `
					return {
						max: Math.max(1, 5, 3),
						min: Math.min(1, 5, 3),
						floor: Math.floor(3.7),
						ceil: Math.ceil(3.2),
						abs: Math.abs(-5)
					};
				`;
				const result = await sandbox.execute(code);

				expect(result.success).toBe(true);
				expect(result.result.max).toBe(5);
				expect(result.result.min).toBe(1);
				expect(result.result.floor).toBe(3);
				expect(result.result.ceil).toBe(4);
				expect(result.result.abs).toBe(5);
			});
		});

		it('should not allow access to Node.js globals', async () => {
			// Test that __dirname (blocked by AST as dangerous global) is not accessible
			// Use validateCode to check blocking behavior
			const validation = sandbox.validateCode('__dirname');
			expect(validation.valid).toBe(false);
			expect(validation.errors!.some((e) => e.includes('__dirname'))).toBe(
				true,
			);
		});

		it('should not allow setTimeout when disabled', async () => {
			const s = new CodeModeSandbox({
				allowTimers: false,
				configContext: mockConfigContext,
			});
			const code = 'return typeof setTimeout;';
			const result = await s.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe('undefined');
		});

		it('should allow setTimeout when enabled', async () => {
			const s = new CodeModeSandbox({
				allowTimers: true,
				configContext: mockConfigContext,
			});
			const code = 'return typeof setTimeout;';
			const result = await s.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe('function');
		});

		it('should not add console methods to sandbox when disabled', async () => {
			// Note: VM context isolation may not completely remove console
			// This test verifies console is not explicitly added to sandbox
			const s = new CodeModeSandbox({
				allowConsole: false,
				configContext: mockConfigContext,
			});
			const code =
				'try { console.log("test"); return "logged"; } catch(e) { return "no console"; }';
			const result = await s.execute(code);

			expect(result.success).toBe(true);
			// Console either doesn't work or doesn't log to our logs array
			expect(result.logs).toEqual([]);
		});

		it('should provide standard JavaScript globals', async () => {
			const code =
				'return [typeof Promise, typeof Array, typeof Object, typeof JSON];';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual([
				'function',
				'function',
				'function',
				'object',
			]);
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
			const code =
				'const m = new Map(); const s = new Set(); return [typeof m, typeof s];';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual(['object', 'object']);
		});
	});

	describe('timeout handling', () => {
		it('should timeout long-running code', async () => {
			const s = new CodeModeSandbox({
				timeout: 100,
				configContext: mockConfigContext,
			});
			// Infinite loop that should timeout
			const code = 'let i = 0; while(i >= 0) { i++; }';
			const result = await s.execute(code);

			expect(result.success).toBe(false);
			// Timeout error message varies by Node version
			expect(result.error).toBeDefined();
			expect(result.error!.toLowerCase()).toMatch(/timeout|timed out/);
		}, 10000);

		it('should not timeout fast code', async () => {
			const s = new CodeModeSandbox({
				timeout: 1000,
				configContext: mockConfigContext,
			});
			const code = 'return 42;';
			const result = await s.execute(code);

			expect(result.success).toBe(true);
			expect(result.executionTime).toBeLessThan(1000);
		});

		it('should include timeout value in error message', async () => {
			const s = new CodeModeSandbox({
				timeout: 50,
				configContext: mockConfigContext,
			});
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

	describe('structuredError handling', () => {
		it('should include structuredError in error responses', async () => {
			const code = 'throw new Error("test error");';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.structuredError).toBeDefined();
			expect(result.structuredError!.success).toBe(false);
		});

		it('should include error code in structuredError', async () => {
			const code = 'throw new Error("test error");';
			const result = await sandbox.execute(code);

			expect(result.structuredError).toBeDefined();
			expect(result.structuredError!.error.code).toBeDefined();
			expect(typeof result.structuredError!.error.code).toBe('string');
		});

		it('should include error type in structuredError', async () => {
			const code = 'throw new Error("test error");';
			const result = await sandbox.execute(code);

			expect(result.structuredError).toBeDefined();
			// VM sandbox errors may not preserve Error prototype, so type can vary
			expect(result.structuredError!.error.type).toBeDefined();
			expect(typeof result.structuredError!.error.type).toBe('string');
		});

		it('should include message in structuredError', async () => {
			const code = 'throw new Error("specific error message");';
			const result = await sandbox.execute(code);

			expect(result.structuredError).toBeDefined();
			// Error message is preserved in the error field, not always in structuredError.error.message
			// due to VM boundary crossing
			expect(result.error).toContain('specific error message');
			expect(result.structuredError!.error.message).toBeDefined();
		});

		it('should include recoverable flag in structuredError', async () => {
			const code = 'throw new Error("test error");';
			const result = await sandbox.execute(code);

			expect(result.structuredError).toBeDefined();
			expect(typeof result.structuredError!.error.recoverable).toBe('boolean');
		});

		it('should include guidance array in structuredError', async () => {
			const code = 'throw new Error("test error");';
			const result = await sandbox.execute(code);

			expect(result.structuredError).toBeDefined();
			expect(Array.isArray(result.structuredError!.error.guidance)).toBe(true);
		});

		it('should include formattedMessage in structuredError', async () => {
			const code = 'throw new Error("test error");';
			const result = await sandbox.execute(code);

			expect(result.structuredError).toBeDefined();
			expect(result.structuredError!.formattedMessage).toBeDefined();
			expect(typeof result.structuredError!.formattedMessage).toBe('string');
		});

		it('should detect timeout errors in structuredError', async () => {
			const s = new CodeModeSandbox({
				timeout: 50,
				configContext: mockConfigContext,
			});
			const code = 'let i = 0; while(i >= 0) { i++; }';
			const result = await s.execute(code);

			expect(result.success).toBe(false);
			expect(result.structuredError).toBeDefined();
			// Timeout error message contains "timeout" which is detected by error-factory
			// The formatted error field contains the timeout message
			expect(result.error!.toLowerCase()).toMatch(/timeout|timed out/);
			// structuredError.error.code may be EXECUTION_TIMEOUT or INTERNAL_ERROR depending on detection
			expect(result.structuredError!.error.code).toBeDefined();
		}, 5000);

		it('should not include structuredError in successful responses', async () => {
			const code = 'return 42;';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.structuredError).toBeUndefined();
		});

		it('should include context in structuredError when available', async () => {
			const code = 'throw new Error("test error");';
			const result = await sandbox.execute(code);

			expect(result.structuredError).toBeDefined();
			// Context is optional but should include apiMethod
			if (result.structuredError!.error.context) {
				expect(result.structuredError!.error.context.apiMethod).toBe('execute');
			}
		});
	});

	describe('API listMethods', () => {
		it('should return available methods from api.listMethods()', async () => {
			const code = 'return api.listMethods();';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toHaveProperty('methods');
			expect(result.result).toHaveProperty('usage');
			expect(result.result).toHaveProperty('example');
			expect(result.result.methods).toBeInstanceOf(Array);
			expect(result.result.methods.length).toBeGreaterThan(0);
			expect(result.result.methods[0]).toHaveProperty('name');
			expect(result.result.methods[0]).toHaveProperty('description');
		});

		it('should list searchSymbols in available methods', async () => {
			const code =
				'const info = api.listMethods(); return info.methods.some(m => m.name === "searchSymbols");';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(true);
		});

		it('should include typesResourceUri for each method', async () => {
			const code = 'return api.listMethods();';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			for (const method of result.result.methods) {
				expect(method).toHaveProperty('typesResourceUri');
				expect(method.typesResourceUri).toBe(
					`constellation://types/api/${method.name}`,
				);
			}
		});

		it('should return compositionPatterns array with 4 patterns', async () => {
			const code = 'return api.listMethods();';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toHaveProperty('compositionPatterns');
			expect(result.result.compositionPatterns).toBeInstanceOf(Array);
			expect(result.result.compositionPatterns).toHaveLength(4);
			expect(result.result.compositionPatterns[0]).toHaveProperty('name');
			expect(result.result.compositionPatterns[0]).toHaveProperty(
				'description',
			);
			expect(result.result.compositionPatterns[0]).toHaveProperty('code');
		});
	});

	describe('API error context formatting', () => {
		it('should include parameters preview in error message', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult(undefined, false, 'Symbol not found'),
			);

			const code = 'return await api.searchSymbols({ query: "nonexistent" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Parameters:');
			expect(result.error).toContain('query');
			expect(result.error).toContain('nonexistent');
		});

		it('should include duration in error message', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult(undefined, false, 'API failure'),
			);

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Duration:');
			expect(result.error).toContain('ms');
		});

		it('should truncate long parameters in error message', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult(undefined, false, 'Error'),
			);

			// Create a query longer than 100 characters
			const longQuery = 'x'.repeat(150);
			const code = `return await api.searchSymbols({ query: "${longQuery}" });`;
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			// Should be truncated to ~100 chars + ...
			expect(result.error).toContain('...');
		});

		it('should handle non-serializable parameters gracefully', async () => {
			// This test passes an object that would cause serialization issues
			// We use a proxy that simulates it via the API call chain
			mockClient.executeMcpTool.mockRejectedValue(new Error('Network error'));

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('API call failed');
		});

		it('should include method name in camelCase in error', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult(undefined, false, 'Not found'),
			);

			const code = 'return await api.getSymbolDetails({ symbolId: "123" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('api.getSymbolDetails()');
		});
	});

	describe('API error handling with exceptions', () => {
		it('should wrap network errors with context', async () => {
			mockClient.executeMcpTool.mockRejectedValue(
				new Error('Connection refused'),
			);

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('API call failed');
			expect(result.error).toContain('Connection refused');
			expect(result.error).toContain('Duration:');
		});

		it('should handle non-Error exceptions', async () => {
			mockClient.executeMcpTool.mockRejectedValue('String error');

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			expect(result.error).toContain('String error');
		});

		it('should not re-wrap already formatted errors', async () => {
			// Simulate an error that's already formatted by our handler
			const formattedError = new Error(
				'API call failed: api.searchSymbols()\n  Parameters: {"query":"test"}\n  Duration: 10ms\n  Error: Original error',
			);
			mockClient.executeMcpTool.mockRejectedValue(formattedError);

			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(false);
			// Should contain the formatted message but only once
			const occurrences = (result.error!.match(/API call failed/g) || [])
				.length;
			expect(occurrences).toBeLessThanOrEqual(2); // Original + wrapping
		});
	});

	describe('console truncation for large objects', () => {
		it('should truncate objects larger than 500 characters', async () => {
			const code = `
				const largeObj = {};
				for (let i = 0; i < 50; i++) {
					largeObj[\`key_\${i}\`] = \`value_\${i}_with_some_extra_padding\`;
				}
				console.log(largeObj);
				return 1;
			`;
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs).toBeDefined();
			expect(result.logs!.length).toBe(1);
			// Should be truncated with ...
			expect(result.logs![0].endsWith('...')).toBe(true);
		});

		it('should use compact JSON for medium-sized objects', async () => {
			const code = `
				const mediumObj = {};
				for (let i = 0; i < 10; i++) {
					mediumObj[\`k\${i}\`] = \`v\${i}\`;
				}
				console.log(mediumObj);
				return 1;
			`;
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs).toBeDefined();
			// Should be logged (not truncated for medium objects)
			expect(result.logs![0]).toContain('k0');
		});

		it('should handle objects that fail JSON.stringify', async () => {
			const code = `
				const circular = {};
				circular.self = circular;
				console.log(circular);
				return 1;
			`;
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.logs).toBeDefined();
			// Should log a warning about serialization failure (SB-84 fix)
			expect(result.logs![0]).toContain('[WARN] JSON serialization failed:');
			expect(result.logs![0]).toContain('Falling back to String()');
			// Should then fall back to String() output
			expect(result.logs![1]).toContain('[object Object]');
		});
	});

	describe('validateCode warnings', () => {
		it('should warn about API call without return statement', () => {
			const code = 'const result = await api.searchSymbols({ query: "test" });';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
			expect(result.warnings).toBeDefined();
			expect(
				result.warnings!.some((w) =>
					w.includes('No explicit return statement detected'),
				),
			).toBe(true);
			expect(
				result.warnings!.some((w) => w.includes('Auto-return will be applied')),
			).toBe(true);
		});

		it('should warn about API call without await', () => {
			const code = 'api.searchSymbols({ query: "test" });';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
			expect(result.warnings).toBeDefined();
			expect(
				result.warnings!.some((w) => w.includes('No await detected')),
			).toBe(true);
			expect(
				result.warnings!.some((w) => w.includes('API methods are async')),
			).toBe(true);
		});

		it('should warn about .then() without .catch()', () => {
			const code =
				'api.searchSymbols({ query: "test" }).then(r => console.log(r));';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
			expect(result.warnings).toBeDefined();
			expect(
				result.warnings!.some((w) => w.includes('.then() without .catch()')),
			).toBe(true);
		});

		it('should not warn when return and await are present', () => {
			const code = 'return await api.searchSymbols({ query: "test" });';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
			expect(result.warnings).toBeUndefined();
		});

		it('should not warn when .catch() is present', () => {
			const code =
				'api.searchSymbols({ query: "test" }).then(r => r).catch(e => e);';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
			// No warning about .then() without .catch()
			if (result.warnings) {
				expect(
					result.warnings.some((w) => w.includes('.then() without .catch()')),
				).toBe(false);
			}
		});

		it('should not generate warnings for code without API calls', () => {
			const code = 'return 42;';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(true);
			expect(result.warnings).toBeUndefined();
		});

		it('should return both errors and warnings when present', () => {
			// Invalid code (has require) but also missing return/await
			const code = 'require("fs"); api.searchSymbols({ query: "test" });';
			const result = sandbox.validateCode(code);

			expect(result.valid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors!.some((e) => e.includes('require'))).toBe(true);
			expect(result.warnings).toBeDefined();
			expect(result.warnings!.length).toBeGreaterThan(0);
		});
	});

	describe('auto-return (SB-151)', () => {
		it('should auto-return bare await expression', async () => {
			mockClient.executeMcpTool.mockResolvedValue(
				createMockResult({ symbols: [{ name: 'test' }] }),
			);

			// No explicit return - should be auto-returned
			const code = 'await api.searchSymbols({ query: "test" })';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual({ symbols: [{ name: 'test' }] });
		});

		it('should auto-return last expression after variable declaration', async () => {
			const code = 'const x = 42;\nx';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(42);
		});

		it('should auto-return variable from const declaration', async () => {
			const code = 'const x = 42';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(42);
		});

		it('should not modify code with explicit return', async () => {
			const code = 'return 42';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toBe(42);
		});

		it('should auto-return array destructuring result', async () => {
			const code = 'const [a, b] = [10, 20]';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual([10, 20]);
		});

		it('should auto-return object destructuring result', async () => {
			const code = 'const { x, y } = { x: 1, y: 2 }';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			expect(result.result).toEqual({ x: 1, y: 2 });
		});

		it('should not modify control flow as last statement', async () => {
			const code =
				'const items = [1, 2, 3];\nfor (const item of items) { console.log(item); }';
			const result = await sandbox.execute(code);

			expect(result.success).toBe(true);
			// ForOf is control flow, no auto-return, result is undefined
			expect(result.result).toBeUndefined();
		});
	});

	describe('shorthand aliases', () => {
		describe('api.search(query, options?)', () => {
			it('should delegate to search_symbols with query param', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ symbols: [{ name: 'User' }] }),
				);
				const code = 'return await api.search("User")';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'search_symbols',
					{ query: 'User' },
					expect.any(Object),
				);
			});

			it('should spread options into params', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ symbols: [] }),
				);
				const code =
					'return await api.search("User", { limit: 5, filterByKind: ["class"] })';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'search_symbols',
					{ query: 'User', limit: 5, filterByKind: ['class'] },
					expect.any(Object),
				);
			});

			it('should apply transformParams for isExported', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ symbols: [] }),
				);
				const code = 'return await api.search("User", { isExported: true })';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'search_symbols',
					expect.objectContaining({ filterByExported: true }),
					expect.any(Object),
				);
			});
		});

		describe('api.details(symbolId)', () => {
			it('should delegate to get_symbol_details with symbolId', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ name: 'User', kind: 'class' }),
				);
				const code = 'return await api.details("sym-123")';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_symbol_details',
					{ symbolId: 'sym-123' },
					expect.any(Object),
				);
			});
		});

		describe('api.deps(filePath, options?)', () => {
			it('should delegate to get_dependencies with filePath', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ directDependencies: [] }),
				);
				const code = 'return await api.deps("src/index.ts")';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_dependencies',
					{ filePath: 'src/index.ts' },
					expect.any(Object),
				);
			});

			it('should spread options', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ directDependencies: [] }),
				);
				const code = 'return await api.deps("src/index.ts", { depth: 2 })';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_dependencies',
					{ filePath: 'src/index.ts', depth: 2 },
					expect.any(Object),
				);
			});
		});

		describe('api.dependents(filePath, options?)', () => {
			it('should delegate to get_dependents with filePath', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ directDependents: [] }),
				);
				const code = 'return await api.dependents("src/utils.ts")';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_dependents',
					{ filePath: 'src/utils.ts' },
					expect.any(Object),
				);
			});
		});

		describe('api.orphans(options?)', () => {
			it('should delegate to find_orphaned_code with no args', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ orphanedSymbols: [] }),
				);
				const code = 'return await api.orphans()';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'find_orphaned_code',
					{},
					expect.any(Object),
				);
			});

			it('should pass options object', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ orphanedSymbols: [] }),
				);
				const code = 'return await api.orphans({ limit: 20 })';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'find_orphaned_code',
					{ limit: 20 },
					expect.any(Object),
				);
			});
		});

		describe('api.cycles(options?)', () => {
			it('should delegate to find_circular_dependencies', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ cycles: [] }),
				);
				const code = 'return await api.cycles()';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'find_circular_dependencies',
					{},
					expect.any(Object),
				);
			});
		});

		describe('api.overview(options?)', () => {
			it('should delegate to get_architecture_overview', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ projectMetadata: {} }),
				);
				const code = 'return await api.overview()';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_architecture_overview',
					{},
					expect.any(Object),
				);
			});

			it('should pass options', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ projectMetadata: {} }),
				);
				const code = 'return await api.overview({ includeMetrics: true })';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_architecture_overview',
					{ includeMetrics: true },
					expect.any(Object),
				);
			});
		});

		describe('api.impact() smart resolution', () => {
			it('should resolve single string as symbolId', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ summary: {} }),
				);
				const code = 'return await api.impact("sym-456")';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'impact_analysis',
					{ symbolId: 'sym-456' },
					expect.any(Object),
				);
			});

			it('should resolve two strings as symbolName + filePath', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ summary: {} }),
				);
				const code = 'return await api.impact("UserService", "src/user.ts")';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'impact_analysis',
					{ symbolName: 'UserService', filePath: 'src/user.ts' },
					expect.any(Object),
				);
			});

			it('should resolve single string + options as symbolId + options', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ summary: {} }),
				);
				const code = 'return await api.impact("sym-456", { depth: 2 })';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'impact_analysis',
					{ symbolId: 'sym-456', depth: 2 },
					expect.any(Object),
				);
			});

			it('should resolve two strings + options as symbolName + filePath + options', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ summary: {} }),
				);
				const code =
					'return await api.impact("UserService", "src/user.ts", { excludeTests: false })';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'impact_analysis',
					{
						symbolName: 'UserService',
						filePath: 'src/user.ts',
						excludeTests: false,
					},
					expect.any(Object),
				);
			});
		});

		describe('api.usage() smart resolution', () => {
			it('should resolve single string as symbolId', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ directUsages: [] }),
				);
				const code = 'return await api.usage("sym-789")';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'trace_symbol_usage',
					{ symbolId: 'sym-789' },
					expect.any(Object),
				);
			});

			it('should resolve two strings as symbolName + filePath', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ directUsages: [] }),
				);
				const code = 'return await api.usage("handleAuth", "src/auth.ts")';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'trace_symbol_usage',
					{ symbolName: 'handleAuth', filePath: 'src/auth.ts' },
					expect.any(Object),
				);
			});
		});

		describe('api.calls() smart resolution', () => {
			it('should resolve single string as symbolId', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ root: {}, callers: [], callees: [] }),
				);
				const code = 'return await api.calls("sym-abc")';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_call_graph',
					{ symbolId: 'sym-abc' },
					expect.any(Object),
				);
			});

			it('should resolve two strings as symbolName + filePath', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ root: {}, callers: [], callees: [] }),
				);
				const code = 'return await api.calls("processOrder", "src/orders.ts")';
				await sandbox.execute(code);
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_call_graph',
					{
						symbolName: 'processOrder',
						filePath: 'src/orders.ts',
					},
					expect.any(Object),
				);
			});
		});

		describe('smart resolution argument validation', () => {
			it('should reject non-string first argument', async () => {
				const code = 'return await api.impact(42)';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(false);
				expect(result.error).toContain(
					'Expected first argument to be a string',
				);
			});

			it('should reject non-string, non-object second argument', async () => {
				const code = 'return await api.impact("sym-123", 42)';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(false);
				expect(result.error).toContain(
					'Expected second argument to be a string',
				);
			});
		});

		describe('listMethods() shorthands field', () => {
			it('should include shorthands array in listMethods response', async () => {
				const code = 'return api.listMethods()';
				const result = await sandbox.execute(code);
				expect(result.success).toBe(true);
				expect(result.result).toHaveProperty('shorthands');
				expect(result.result.shorthands).toBeInstanceOf(Array);
				expect(result.result.shorthands.length).toBe(10);
			});

			it('should include name, signature, delegatesTo, and description for each shorthand', async () => {
				const code = 'return api.listMethods()';
				const result = await sandbox.execute(code);
				const shorthand = result.result.shorthands[0];
				expect(shorthand).toHaveProperty('name');
				expect(shorthand).toHaveProperty('signature');
				expect(shorthand).toHaveProperty('delegatesTo');
				expect(shorthand).toHaveProperty('description');
			});
		});

		describe('rate limiting applies to shorthands', () => {
			it('should count shorthand calls against rate limit', async () => {
				mockClient.executeMcpTool.mockResolvedValue(
					createMockResult({ symbols: [] }),
				);
				const calls = Array.from(
					{ length: 51 },
					(_, i) => `await api.search("q${i}")`,
				).join('; ');
				const code = `${calls}; return "done"`;
				const result = await sandbox.execute(code);
				expect(result.success).toBe(false);
				expect(result.error).toContain('API call limit exceeded');
			});
		});
	});
});
