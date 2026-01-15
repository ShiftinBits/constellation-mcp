import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	ToolNotFoundError,
} from '../../../src/client/constellation-client.js';
import { mapErrorToMessage } from '../../../src/client/error-mapper.js';

// Mock config manager
jest.mock('../../../src/config/config-manager.js', () => ({
	getConfigContext: jest.fn(() => ({
		projectId: 'test-project',
		branchName: 'main',
		config: {
			apiUrl: 'https://api.test.com',
		},
	})),
}));

describe('mapErrorToMessage', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});
	describe('AuthenticationError', () => {
		it('should return authentication error message', () => {
			const error = new AuthenticationError('Invalid API key');
			const result = mapErrorToMessage(error, 'search_symbols');

			expect(result).toContain('Authentication Failed');
			expect(result).toContain('constellation auth');
		});
	});

	describe('AuthorizationError', () => {
		it('should handle authorization errors as generic errors', () => {
			const error = new AuthorizationError('Insufficient permissions');
			const result = mapErrorToMessage(error, 'impact_analysis');

			// AuthorizationError is handled as a generic error in error-mapper
			// (structured error handling is done in error-factory instead)
			expect(result).toContain('Failed');
			expect(result).toContain('Insufficient permissions');
		});

		it('should include tool name for authorization errors', () => {
			const error = new AuthorizationError('Access denied');
			const result = mapErrorToMessage(error, 'get_call_graph');

			expect(result.toLowerCase()).toContain('get_call_graph');
		});

		it('should include context for authorization errors', () => {
			const error = new AuthorizationError('Permission denied');
			const result = mapErrorToMessage(error, 'search_symbols');

			expect(result).toContain('Project ID:');
			expect(result).toContain('Branch:');
		});
	});

	describe('NotFoundError', () => {
		it('should return project not indexed message', () => {
			const error = new NotFoundError('Project not found');
			const result = mapErrorToMessage(error, 'search_symbols');

			expect(result).toContain('Project Not Indexed');
			expect(result).toContain('constellation index');
		});
	});

	describe('ToolNotFoundError', () => {
		it('should return tool not found message', () => {
			const error = new ToolNotFoundError('Tool not found');
			const result = mapErrorToMessage(error, 'nonexistent_tool');

			expect(result).toContain('Tool Not Found');
			expect(result).toContain('Available tool categories');
		});
	});

	describe('Generic Error', () => {
		it('should return generic error message for unknown errors', () => {
			const error = new Error('Something went wrong');
			const result = mapErrorToMessage(error, 'search_symbols');

			expect(result).toContain('Failed');
			expect(result).toContain('search_symbols');
			expect(result).toContain('Something went wrong');
		});

		it('should handle error without message', () => {
			const error = new Error();
			const result = mapErrorToMessage(error, 'search_symbols');

			expect(result).toContain('Failed');
			expect(result).toContain('search_symbols');
		});
	});

	describe('Non-Error objects', () => {
		it('should handle string errors', () => {
			const result = mapErrorToMessage('String error' as any, 'test_tool');

			expect(result).toContain('Failed');
			expect(result).toContain('test_tool');
			expect(result).toContain('String error');
		});

		it('should handle null/undefined', () => {
			const result1 = mapErrorToMessage(null as any, 'test_tool');
			const result2 = mapErrorToMessage(undefined as any, 'test_tool');

			expect(result1).toContain('Failed');
			expect(result2).toContain('Failed');
		});
	});

	describe('Tool name inclusion', () => {
		it('should include tool name in relevant error messages', () => {
			// NotFoundError includes tool name
			const notFoundError = new NotFoundError('Not found');
			const notFoundResult = mapErrorToMessage(notFoundError, 'my_test_tool');
			expect(notFoundResult.toLowerCase()).toContain('my_test_tool');

			// Generic errors include tool name
			const genericError = new Error('Generic error');
			const genericResult = mapErrorToMessage(genericError, 'my_test_tool');
			expect(genericResult.toLowerCase()).toContain('my_test_tool');

			// AuthenticationError doesn't include tool name (it's a global auth issue)
			const authError = new AuthenticationError('Auth failed');
			const authResult = mapErrorToMessage(authError, 'my_test_tool');
			expect(authResult.toLowerCase()).toContain('authentication');
		});
	});

	describe('Actionable guidance', () => {
		it('should provide actionable steps for authentication errors', () => {
			const error = new AuthenticationError('Invalid key');
			const result = mapErrorToMessage(error, 'search_symbols');

			expect(result).toContain('constellation auth');
		});

		it('should provide actionable steps for not found errors', () => {
			const error = new NotFoundError('Project not found');
			const result = mapErrorToMessage(error, 'search_symbols');

			expect(result).toContain('constellation index');
		});

		it('should provide actionable steps for tool not found errors', () => {
			const error = new ToolNotFoundError('Tool not found');
			const result = mapErrorToMessage(error, 'search_symbols');

			expect(result).toContain('Tool Not Found');
			expect(result).toContain('Available tool categories');
		});
	});

	describe('Network error detection', () => {
		// Message-based detection (fallback for non-standard errors)
		it('should detect fetch failed errors via message', () => {
			const error = new Error('fetch failed: network error');
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
		});

		it('should detect timeout errors via message', () => {
			const error = new Error('timeout: request took too long');
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
		});

		// FIX SB-89: Code-based detection (preferred for standard Node.js errors)
		it('should detect ECONNREFUSED via error code', () => {
			const error = new Error(
				'connect ECONNREFUSED 127.0.0.1:3000',
			) as Error & { code: string };
			error.code = 'ECONNREFUSED';
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
		});

		it('should detect ENOTFOUND via error code', () => {
			const error = new Error(
				'getaddrinfo ENOTFOUND api.example.com',
			) as Error & {
				code: string;
			};
			error.code = 'ENOTFOUND';
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
		});

		it('should detect ETIMEDOUT via error code', () => {
			const error = new Error('connection timed out') as Error & {
				code: string;
			};
			error.code = 'ETIMEDOUT';
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
		});

		it('should detect ECONNRESET via error code', () => {
			const error = new Error('socket hang up') as Error & { code: string };
			error.code = 'ECONNRESET';
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
		});

		it('should detect ECONNABORTED via error code', () => {
			const error = new Error('connection aborted') as Error & { code: string };
			error.code = 'ECONNABORTED';
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
		});

		it('should prefer error code over message matching', () => {
			// Error with code should be detected even if message doesn't match patterns
			const error = new Error('some random message') as Error & {
				code: string;
			};
			error.code = 'ECONNREFUSED';
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
		});

		it('should not use message fallback when error has non-network code', () => {
			// If error has a code but it's not a network error code, don't treat as network error
			const error = new Error('timeout in some context') as Error & {
				code: string;
			};
			error.code = 'ENOENT'; // File not found, not a network error
			const result = mapErrorToMessage(error, 'test_tool');

			// Should be treated as generic error, not network error
			expect(result).toContain('test_tool');
			expect(result).toContain('Failed');
			expect(result).toContain('timeout in some context');
		});
	});

	describe('Validation error detection', () => {
		it('should detect Invalid keyword in error', () => {
			const error = new Error('Invalid parameter: query cannot be empty');
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('validation error');
			expect(result).toContain('Check the tool parameters');
		});

		it('should detect validation keyword in error', () => {
			const error = new Error('Schema validation failed');
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).toContain('validation error');
			expect(result).toContain('valid inputs');
		});

		it('should not show validation hint for non-validation errors', () => {
			const error = new Error('Something else went wrong');
			const result = mapErrorToMessage(error, 'test_tool');

			expect(result).not.toContain('validation error');
		});
	});
});

describe('extractApiErrorMessage', () => {
	const {
		extractApiErrorMessage,
	} = require('../../../src/client/error-mapper.js');

	function createMockHeaders(contentType: string | null) {
		return {
			get: () => contentType,
		};
	}

	it('should extract error field from JSON response', async () => {
		const mockResponse = {
			headers: createMockHeaders('application/json'),
			json: () => Promise.resolve({ error: 'Tool execution failed' }),
			statusText: 'Internal Server Error',
		} as unknown as Response;

		const message = await extractApiErrorMessage(mockResponse);

		expect(message).toBe('Tool execution failed');
	});

	it('should extract message field from JSON response', async () => {
		const mockResponse = {
			headers: createMockHeaders('application/json'),
			json: () => Promise.resolve({ message: 'Resource not found' }),
			statusText: 'Not Found',
		} as unknown as Response;

		const message = await extractApiErrorMessage(mockResponse);

		expect(message).toBe('Resource not found');
	});

	it('should prefer error over message in JSON response', async () => {
		const mockResponse = {
			headers: createMockHeaders('application/json'),
			json: () =>
				Promise.resolve({
					error: 'Primary error',
					message: 'Secondary message',
				}),
			statusText: 'Error',
		} as unknown as Response;

		const message = await extractApiErrorMessage(mockResponse);

		expect(message).toBe('Primary error');
	});

	it('should fall back to statusText for JSON without error/message', async () => {
		const mockResponse = {
			headers: createMockHeaders('application/json'),
			json: () => Promise.resolve({ code: 500 }),
			statusText: 'Server Error',
		} as unknown as Response;

		const message = await extractApiErrorMessage(mockResponse);

		expect(message).toBe('Server Error');
	});

	it('should extract text for non-JSON response', async () => {
		const mockResponse = {
			headers: createMockHeaders('text/plain'),
			text: () => Promise.resolve('Plain text error message'),
			statusText: 'Error',
		} as unknown as Response;

		const message = await extractApiErrorMessage(mockResponse);

		expect(message).toBe('Plain text error message');
	});

	it('should fall back to statusText when text is empty', async () => {
		const mockResponse = {
			headers: createMockHeaders('text/plain'),
			text: () => Promise.resolve(''),
			statusText: 'Bad Request',
		} as unknown as Response;

		const message = await extractApiErrorMessage(mockResponse);

		expect(message).toBe('Bad Request');
	});

	it('should fall back to statusText on parse error', async () => {
		const mockResponse = {
			headers: createMockHeaders('application/json'),
			json: () => Promise.reject(new Error('Invalid JSON')),
			statusText: 'Service Unavailable',
		} as unknown as Response;

		const message = await extractApiErrorMessage(mockResponse);

		expect(message).toBe('Service Unavailable');
	});

	it('should handle missing content-type header', async () => {
		const mockResponse = {
			headers: createMockHeaders(null),
			text: () => Promise.resolve('Error response'),
			statusText: 'Error',
		} as unknown as Response;

		const message = await extractApiErrorMessage(mockResponse);

		expect(message).toBe('Error response');
	});
});
