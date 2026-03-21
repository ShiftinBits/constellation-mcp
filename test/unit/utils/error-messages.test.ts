/**
 * Error Messages Utility Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
	standardErrors,
	formatErrorMessage,
} from '../../../src/utils/error-messages.js';

describe('standardErrors', () => {
	describe('noData', () => {
		it('should return message about missing data', () => {
			const result = standardErrors.noData('test_tool');

			expect(result).toContain('No data found');
			expect(result).toContain('constellation index');
		});
	});

	describe('incompleteData', () => {
		it('should return message with feature name', () => {
			const result = standardErrors.incompleteData('call graph');

			expect(result).toContain('call graph');
			expect(result).toContain('not available');
		});
	});

	describe('parameterMismatch', () => {
		it('should list required and provided parameters', () => {
			const result = standardErrors.parameterMismatch(
				['query', 'depth'],
				['query'],
			);

			expect(result).toContain('query, depth');
			expect(result).toContain('query');
			expect(result).toContain('Parameter mismatch');
		});
	});

	describe('symbolNotFound', () => {
		it('should include symbol identifier in message', () => {
			const result = standardErrors.symbolNotFound('MyClass.myMethod');

			expect(result).toContain('MyClass.myMethod');
			expect(result).toContain('Symbol not found');
			expect(result).toContain('search_symbols');
		});
	});

	describe('fileNotFound', () => {
		it('should include file path in message', () => {
			const result = standardErrors.fileNotFound('src/utils/helpers.ts');

			expect(result).toContain('src/utils/helpers.ts');
			expect(result).toContain('File not found');
		});
	});

	describe('projectNotFound', () => {
		it('should include project ID in message', () => {
			const result = standardErrors.projectNotFound('my-project');

			expect(result).toContain('my-project');
			expect(result).toContain('Project not found');
			expect(result).toContain('constellation index');
		});
	});

	describe('apiError', () => {
		it('should include endpoint in message', () => {
			const result = standardErrors.apiError('mcp/execute');

			expect(result).toContain('mcp/execute');
			expect(result).toContain('API Error');
		});

		it('should include status code when provided', () => {
			const result = standardErrors.apiError('mcp/execute', 500);

			expect(result).toContain('500');
			expect(result).toContain('Status Code');
		});

		it('should include details when provided', () => {
			const result = standardErrors.apiError(
				'mcp/execute',
				500,
				'Connection refused',
			);

			expect(result).toContain('Connection refused');
			expect(result).toContain('Details');
		});

		it('should work without optional parameters', () => {
			const result = standardErrors.apiError('test/endpoint');

			expect(result).toContain('test/endpoint');
			expect(result).not.toContain('Status Code');
			expect(result).not.toContain('Details');
		});
	});

	describe('emptyResults', () => {
		it('should include query type in message', () => {
			const result = standardErrors.emptyResults('symbols');

			expect(result).toContain('symbols');
			expect(result).toContain('No symbols found');
		});
	});

	describe('unsupported', () => {
		it('should include operation name', () => {
			const result = standardErrors.unsupported('reverse engineering');

			expect(result).toContain('reverse engineering');
			expect(result).toContain('not supported');
		});

		it('should include reason when provided', () => {
			const result = standardErrors.unsupported(
				'batch delete',
				'Not implemented yet',
			);

			expect(result).toContain('batch delete');
			expect(result).toContain('Not implemented yet');
			expect(result).toContain('Reason');
		});

		it('should work without reason', () => {
			const result = standardErrors.unsupported('experimental feature');

			expect(result).toContain('experimental feature');
			expect(result).not.toContain('Reason');
		});
	});

	describe('configurationError', () => {
		it('should include error details', () => {
			const result = standardErrors.configurationError('File not found');

			expect(result).toContain('File not found');
			expect(result).toContain('constellation.json');
			expect(result).toContain('constellation init');
		});

		it('should include working directory when provided', () => {
			const result = standardErrors.configurationError(
				'Parse error',
				'/home/user/project',
			);

			expect(result).toContain('/home/user/project');
			expect(result).toContain('Working directory');
		});

		it('should not include working directory when not provided', () => {
			const result = standardErrors.configurationError('Error');

			expect(result).not.toContain('Working directory');
		});
	});
});

describe('formatErrorMessage', () => {
	const originalEnv = process.env.NODE_ENV;

	afterEach(() => {
		process.env.NODE_ENV = originalEnv;
	});

	it('should format Error object message', () => {
		const error = new Error('Something went wrong');
		const result = formatErrorMessage(error);

		expect(result).toBe('Something went wrong');
	});

	it('should format string error', () => {
		const result = formatErrorMessage('Plain string error');

		expect(result).toBe('Plain string error');
	});

	it('should include context when provided', () => {
		const error = new Error('Test error');
		const result = formatErrorMessage(error, 'search_symbols');

		expect(result).toContain('Error in search_symbols');
		expect(result).toContain('Test error');
	});

	it('should include stack trace in development mode', () => {
		process.env.NODE_ENV = 'development';
		const error = new Error('Dev error');
		const result = formatErrorMessage(error, 'test');

		expect(result).toContain('Stack trace');
	});

	it('should not include stack trace in production mode', () => {
		process.env.NODE_ENV = 'production';
		const error = new Error('Prod error');
		const result = formatErrorMessage(error);

		expect(result).not.toContain('Stack trace');
	});

	it('should handle null error', () => {
		const result = formatErrorMessage(null);

		expect(result).toBe('null');
	});

	it('should handle undefined error', () => {
		const result = formatErrorMessage(undefined);

		expect(result).toBe('undefined');
	});

	it('should handle object error without message', () => {
		const result = formatErrorMessage({ code: 500 });

		expect(result).toContain('object');
	});
});
