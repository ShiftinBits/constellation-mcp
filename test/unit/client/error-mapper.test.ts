import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthenticationError, NotFoundError, ToolNotFoundError } from '../../../src/client/constellation-client.js';
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
});
