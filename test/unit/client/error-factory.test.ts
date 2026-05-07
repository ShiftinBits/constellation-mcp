import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
	AuthenticationError,
	AuthorizationError,
	ConfigurationError,
	NotFoundError,
	TimeoutError,
	ToolNotFoundError,
	UnsupportedLanguageError,
} from '../../../src/client/constellation-client.js';
import { createStructuredError } from '../../../src/client/error-factory.js';
import { MemoryExceededError } from '../../../src/code-mode/sandbox.js';
import { ErrorCode } from '../../../src/types/mcp-errors.js';

// Mock config cache - include apiKey to simulate authenticated state
jest.mock('../../../src/config/config-cache.js', () => ({
	configCache: {
		getDefaultConfig: jest.fn(() => ({
			projectId: 'test-project',
			branchName: 'main',
			apiKey: 'test-api-key', // FIX SB-88: Include apiKey for authenticated tests
			config: {
				apiUrl: 'https://api.test.com',
			},
			configLoaded: true,
			gitRoot: '/test/project',
		})),
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

describe('createStructuredError', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('AuthenticationError', () => {
		it('should return AUTH_ERROR code', () => {
			const error = new AuthenticationError('Invalid API key');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.AUTH_ERROR);
			expect(result.error.type).toBe('AuthenticationError');
		});

		it('should be recoverable', () => {
			const error = new AuthenticationError('Invalid API key');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.recoverable).toBe(true);
		});

		it('should provide actionable guidance', () => {
			const error = new AuthenticationError('Invalid API key');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.guidance).toContain('Run: constellation auth');
			expect(result.error.guidance.length).toBeGreaterThan(0);
		});

		it('should include context', () => {
			const error = new AuthenticationError('Invalid API key');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.context?.projectId).toBe('test-project');
			expect(result.error.context?.branchName).toBe('main');
			expect(result.error.context?.apiMethod).toBe('search_symbols');
		});

		it('should include documentation link', () => {
			const error = new AuthenticationError('Invalid API key');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.docs).toBeDefined();
			expect(result.error.docs).toContain('docs');
		});

		it('should include formatted message', () => {
			const error = new AuthenticationError('Invalid API key');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.formattedMessage).toBeDefined();
			expect(result.formattedMessage.length).toBeGreaterThan(0);
		});
	});

	describe('AuthorizationError', () => {
		it('should return AUTHZ_ERROR code', () => {
			const error = new AuthorizationError('Insufficient permissions');
			const result = createStructuredError(error, 'impact_analysis');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.AUTHZ_ERROR);
			expect(result.error.type).toBe('AuthorizationError');
		});

		it('should be recoverable', () => {
			const error = new AuthorizationError('Insufficient permissions');
			const result = createStructuredError(error, 'impact_analysis');

			expect(result.error.recoverable).toBe(true);
		});

		it('should provide appropriate guidance', () => {
			const error = new AuthorizationError('Insufficient permissions');
			const result = createStructuredError(error, 'impact_analysis');

			expect(
				result.error.guidance.some((g) =>
					g.toLowerCase().includes('permission'),
				),
			).toBe(true);
		});
	});

	describe('ConfigurationError', () => {
		it('should return NOT_CONFIGURED code', () => {
			const error = new ConfigurationError('constellation.json not found');
			const result = createStructuredError(error, 'code_intel');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.NOT_CONFIGURED);
			expect(result.error.type).toBe('ConfigurationError');
		});

		it('should be recoverable', () => {
			const error = new ConfigurationError('constellation.json not found');
			const result = createStructuredError(error, 'code_intel');

			expect(result.error.recoverable).toBe(true);
		});

		it('should include init guidance', () => {
			const error = new ConfigurationError('constellation.json not found');
			const result = createStructuredError(error, 'code_intel');

			expect(
				result.error.guidance.some((g) => g.includes('constellation init')),
			).toBe(true);
		});

		it('should include cwd guidance with example path', () => {
			const error = new ConfigurationError('constellation.json not found');
			const result = createStructuredError(error, 'code_intel');

			expect(result.error.guidance.some((g) => g.includes('cwd'))).toBe(true);
			expect(
				result.error.guidance.some((g) => g.includes('/path/to/project')),
			).toBe(true);
		});
	});

	describe('ToolNotFoundError', () => {
		it('should return TOOL_NOT_FOUND code', () => {
			const error = new ToolNotFoundError('Tool not found');
			const result = createStructuredError(error, 'nonexistent_tool');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
			expect(result.error.type).toBe('ToolNotFoundError');
		});

		it('should not be recoverable', () => {
			const error = new ToolNotFoundError('Tool not found');
			const result = createStructuredError(error, 'nonexistent_tool');

			expect(result.error.recoverable).toBe(false);
		});
	});

	describe('NotFoundError', () => {
		it('should return PROJECT_NOT_INDEXED code', () => {
			const error = new NotFoundError('Project not found');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.PROJECT_NOT_INDEXED);
			expect(result.error.type).toBe('NotFoundError');
		});

		it('should be recoverable', () => {
			const error = new NotFoundError('Project not found');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.recoverable).toBe(true);
		});

		it('should include index guidance', () => {
			const error = new NotFoundError('Project not found');
			const result = createStructuredError(error, 'search_symbols');

			expect(
				result.error.guidance.some((g) => g.includes('constellation index')),
			).toBe(true);
		});
	});

	describe('TimeoutError', () => {
		it('should return EXECUTION_TIMEOUT code', () => {
			const error = new TimeoutError('Operation timed out after 30s');
			const result = createStructuredError(error, 'get_call_graph');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.EXECUTION_TIMEOUT);
			expect(result.error.type).toBe('TimeoutError');
		});

		it('should be recoverable', () => {
			const error = new TimeoutError('Operation timed out');
			const result = createStructuredError(error, 'get_call_graph');

			expect(result.error.recoverable).toBe(true);
		});
	});

	describe('MemoryExceededError handling', () => {
		it('should create structured error with MEMORY_EXCEEDED code', () => {
			const error = new MemoryExceededError(150.5, 128);
			const result = createStructuredError(error, 'execute');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.MEMORY_EXCEEDED);
			expect(result.error.type).toBe('MemoryExceededError');
			expect(result.error.recoverable).toBe(true);
		});

		it('should include memory values in message', () => {
			const error = new MemoryExceededError(150.5, 128);
			const result = createStructuredError(error, 'execute');

			expect(result.error.message).toContain('150.5');
			expect(result.error.message).toContain('128');
		});

		it('should provide actionable guidance', () => {
			const error = new MemoryExceededError(200, 128);
			const result = createStructuredError(error, 'execute');

			expect(result.error.guidance.length).toBeGreaterThan(0);
			expect(
				result.error.guidance.some(
					(g) => g.includes('pagination') || g.includes('limit'),
				),
			).toBe(true);
		});
	});

	describe('Network errors (from message)', () => {
		it('should detect ECONNREFUSED as API_UNREACHABLE', () => {
			const error = new Error('ECONNREFUSED: connection refused');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.API_UNREACHABLE);
			expect(result.error.recoverable).toBe(true);
		});

		it('should detect fetch failed as API_UNREACHABLE', () => {
			const error = new Error('fetch failed: network error');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.API_UNREACHABLE);
		});

		it('should detect ENOTFOUND as API_UNREACHABLE', () => {
			const error = new Error('ENOTFOUND: DNS lookup failed');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.API_UNREACHABLE);
		});
	});

	describe('Timeout errors (from message)', () => {
		it('should detect timeout in message as EXECUTION_TIMEOUT', () => {
			const error = new Error('Request timeout after 30000ms');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.EXECUTION_TIMEOUT);
		});

		it('should detect timed out in message as EXECUTION_TIMEOUT', () => {
			const error = new Error('Operation timed out');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.EXECUTION_TIMEOUT);
		});
	});

	describe('Validation errors (from message)', () => {
		it('should detect Invalid keyword as VALIDATION_ERROR', () => {
			const error = new Error('Invalid parameter: query cannot be empty');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
			expect(result.error.recoverable).toBe(true);
		});

		it('should detect validation keyword as VALIDATION_ERROR', () => {
			const error = new Error('Schema validation failed');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
		});
	});

	describe('Rate limiting', () => {
		it('should detect rate limit as RATE_LIMITED', () => {
			const error = new Error('Rate limit exceeded');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.RATE_LIMITED);
			expect(result.error.recoverable).toBe(true);
		});

		it('should detect too many requests as RATE_LIMITED', () => {
			const error = new Error('Too many requests');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.RATE_LIMITED);
		});
	});

	describe('Service unavailable', () => {
		it('should detect 503 as SERVICE_UNAVAILABLE', () => {
			const error = new Error('503 Service Temporarily Unavailable');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
			expect(result.error.recoverable).toBe(true);
		});

		it('should detect service unavailable text as SERVICE_UNAVAILABLE', () => {
			const error = new Error('Service unavailable');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
		});
	});

	describe('Generic errors', () => {
		it('should default to EXECUTION_ERROR for unrecognized errors', () => {
			const error = new Error('Something completely unexpected happened');
			const result = createStructuredError(error, 'search_symbols');

			expect(result.error.code).toBe(ErrorCode.EXECUTION_ERROR);
			expect(result.error.recoverable).toBe(false);
		});
	});

	describe('Unknown error types', () => {
		it('should handle string errors', () => {
			const result = createStructuredError('String error' as any, 'test_tool');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.INTERNAL_ERROR);
			expect(result.formattedMessage).toContain('String error');
		});

		it('should handle null', () => {
			const result = createStructuredError(null as any, 'test_tool');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.INTERNAL_ERROR);
		});

		it('should handle undefined', () => {
			const result = createStructuredError(undefined as any, 'test_tool');

			expect(result.success).toBe(false);
			expect(result.error.code).toBe(ErrorCode.INTERNAL_ERROR);
		});
	});

	describe('Response structure', () => {
		it('should always include success: false', () => {
			const errors = [
				new AuthenticationError('test'),
				new AuthorizationError('test'),
				new NotFoundError('test'),
				new Error('test'),
			];

			for (const error of errors) {
				const result = createStructuredError(error, 'test');
				expect(result.success).toBe(false);
			}
		});

		it('should always include error object with required fields', () => {
			const error = new Error('test error');
			const result = createStructuredError(error, 'test_tool');

			expect(result.error.code).toBeDefined();
			expect(result.error.type).toBeDefined();
			expect(result.error.message).toBeDefined();
			expect(typeof result.error.recoverable).toBe('boolean');
			expect(Array.isArray(result.error.guidance)).toBe(true);
		});

		it('should always include formattedMessage', () => {
			const error = new Error('test error');
			const result = createStructuredError(error, 'test_tool');

			expect(result.formattedMessage).toBeDefined();
			expect(typeof result.formattedMessage).toBe('string');
		});
	});

	describe('Context handling', () => {
		it('should use provided apiMethod', () => {
			const error = new AuthenticationError('test');
			const result = createStructuredError(error, 'my_custom_method');

			expect(result.error.context?.apiMethod).toBe('my_custom_method');
		});

		it('should handle missing apiMethod', () => {
			const error = new AuthenticationError('test');
			const result = createStructuredError(error);

			expect(result.error.context?.apiMethod).toBeUndefined();
		});
	});
});

describe('Symbol/File errors from message', () => {
	it('should detect symbol not found as SYMBOL_NOT_FOUND', () => {
		const error = new Error('Symbol not found: UserService');
		const result = createStructuredError(error, 'get_symbol_details');

		expect(result.error.code).toBe(ErrorCode.SYMBOL_NOT_FOUND);
		expect(result.error.type).toBe('SymbolNotFoundError');
		expect(result.error.recoverable).toBe(true);
	});

	it('should detect symbol in message as SYMBOL_NOT_FOUND', () => {
		const error = new Error('No symbol with name "UserService" found');
		const result = createStructuredError(error, 'search_symbols');

		expect(result.error.code).toBe(ErrorCode.SYMBOL_NOT_FOUND);
	});

	it('should include guidance for SYMBOL_NOT_FOUND', () => {
		const error = new Error('Symbol not found: UserService');
		const result = createStructuredError(error, 'get_symbol_details');

		expect(result.error.guidance.some((g) => g.includes('searchSymbols'))).toBe(
			true,
		);
	});

	it('should detect file not found as FILE_NOT_FOUND', () => {
		const error = new Error('File not found: /src/index.ts');
		const result = createStructuredError(error, 'get_file_details');

		expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
		expect(result.error.type).toBe('FileNotFoundError');
		expect(result.error.recoverable).toBe(true);
	});

	it('should detect file in message as FILE_NOT_FOUND', () => {
		const error = new Error('No file at path /src/main.ts');
		const result = createStructuredError(error, 'get_dependencies');

		expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
	});

	it('should include guidance for FILE_NOT_FOUND', () => {
		const error = new Error('File not found: /src/index.ts');
		const result = createStructuredError(error, 'get_file_details');

		expect(result.error.guidance.some((g) => g.includes('file'))).toBe(true);
	});

	it('should NOT classify generic "symbol" mention as SYMBOL_NOT_FOUND', () => {
		const error = new Error('Invalid symbol table in compiled module');
		const result = createStructuredError(error, 'get_symbol_details');

		expect(result.error.code).not.toBe(ErrorCode.SYMBOL_NOT_FOUND);
	});

	it('should NOT classify generic "file" mention as FILE_NOT_FOUND', () => {
		const error = new Error('Cannot process the file format');
		const result = createStructuredError(error, 'get_dependencies');

		expect(result.error.code).not.toBe(ErrorCode.FILE_NOT_FOUND);
	});
});

describe('createStructuredError - UnsupportedLanguageError mapping', () => {
	it('should map UnsupportedLanguageError to UNSUPPORTED_LANGUAGE code', () => {
		const err = new UnsupportedLanguageError(
			'foo.py',
			'.py',
			new Set(['.ts', '.tsx']),
		);

		const result = createStructuredError(err);

		expect(result.success).toBe(false);
		expect(result.error.code).toBe(ErrorCode.UNSUPPORTED_LANGUAGE);
		expect(result.error.type).toBe('UnsupportedLanguageError');
		expect(result.error.recoverable).toBe(true);
	});

	it('should populate guidance with filePath, extension, and configured extensions', () => {
		const err = new UnsupportedLanguageError(
			'lib/foo.py',
			'.py',
			new Set(['.ts', '.tsx']),
		);

		const result = createStructuredError(err);
		const joined = result.error.guidance.join(' ');

		expect(joined).toContain('lib/foo.py');
		expect(joined).toContain('.py');
		expect(joined).toContain('.ts');
		expect(joined).toContain('.tsx');
		expect(joined).toContain('constellation.json');
	});

	it('should NOT demote to EXECUTION_ERROR when message contains validation keyword (branch-ordering test)', () => {
		// If the new branch is moved AFTER the generic instanceof Error catch-all,
		// createErrorFromMessage will keyword-match 'invalid'/'validation'/'required'
		// and demote the result to VALIDATION_ERROR. This test pins the ordering.
		class TrickyError extends UnsupportedLanguageError {
			constructor() {
				super('foo.py', '.py', new Set(['.ts']));
				Object.defineProperty(this, 'message', {
					value: 'invalid validation required: bogus',
					configurable: true,
				});
			}
		}

		const result = createStructuredError(new TrickyError());

		expect(result.error.code).toBe(ErrorCode.UNSUPPORTED_LANGUAGE);
		expect(result.error.code).not.toBe(ErrorCode.VALIDATION_ERROR);
		expect(result.error.code).not.toBe(ErrorCode.EXECUTION_ERROR);
	});
});

describe('Error code consistency', () => {
	it('should use valid ErrorCode values', () => {
		const validCodes = Object.values(ErrorCode);
		const errors = [
			new AuthenticationError('test'),
			new AuthorizationError('test'),
			new ConfigurationError('test'),
			new NotFoundError('test'),
			new ToolNotFoundError('test'),
			new TimeoutError('test'),
			new Error('ECONNREFUSED'),
			new Error('timeout'),
			new Error('invalid'),
			new Error('rate limit'),
			new Error('503'),
			new Error('unknown'),
		];

		for (const error of errors) {
			const result = createStructuredError(error, 'test');
			expect(validCodes).toContain(result.error.code);
		}
	});
});
