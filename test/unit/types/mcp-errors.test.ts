import { describe, it, expect } from '@jest/globals';
import {
	ErrorCode,
	ErrorCodeType,
	McpErrorResponse,
	isMcpErrorResponse,
	isRecoverableError,
} from '../../../src/types/mcp-errors.js';

describe('ErrorCode', () => {
	it('should have all expected error codes', () => {
		expect(ErrorCode.AUTH_ERROR).toBe('AUTH_ERROR');
		expect(ErrorCode.AUTHZ_ERROR).toBe('AUTHZ_ERROR');
		expect(ErrorCode.AUTH_EXPIRED).toBe('AUTH_EXPIRED');
		expect(ErrorCode.NOT_CONFIGURED).toBe('NOT_CONFIGURED');
		expect(ErrorCode.API_UNREACHABLE).toBe('API_UNREACHABLE');
		expect(ErrorCode.PROJECT_NOT_INDEXED).toBe('PROJECT_NOT_INDEXED');
		expect(ErrorCode.BRANCH_NOT_FOUND).toBe('BRANCH_NOT_FOUND');
		expect(ErrorCode.STALE_INDEX).toBe('STALE_INDEX');
		expect(ErrorCode.SYMBOL_NOT_FOUND).toBe('SYMBOL_NOT_FOUND');
		expect(ErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
		expect(ErrorCode.TOOL_NOT_FOUND).toBe('TOOL_NOT_FOUND');
		expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
		expect(ErrorCode.EXECUTION_ERROR).toBe('EXECUTION_ERROR');
		expect(ErrorCode.EXECUTION_TIMEOUT).toBe('EXECUTION_TIMEOUT');
		expect(ErrorCode.MEMORY_EXCEEDED).toBe('MEMORY_EXCEEDED');
		expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
		expect(ErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
		expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
	});

	it('should have exactly 18 error codes', () => {
		const codeCount = Object.keys(ErrorCode).length;
		expect(codeCount).toBe(18);
	});

	it('should not contain any undefined values', () => {
		Object.values(ErrorCode).forEach((code) => {
			expect(code).toBeDefined();
			expect(typeof code).toBe('string');
			expect(code.length).toBeGreaterThan(0);
		});
	});
});

describe('isMcpErrorResponse', () => {
	it('should return true for valid error response', () => {
		const response: McpErrorResponse = {
			success: false,
			error: {
				code: ErrorCode.AUTH_ERROR,
				type: 'AuthenticationError',
				message: 'Invalid API key',
				recoverable: true,
				guidance: ['Run: constellation auth'],
			},
			formattedMessage: 'Authentication failed',
		};
		expect(isMcpErrorResponse(response)).toBe(true);
	});

	it('should return true for error response with all optional fields', () => {
		const response: McpErrorResponse = {
			success: false,
			error: {
				code: ErrorCode.PROJECT_NOT_INDEXED,
				type: 'NotFoundError',
				message: 'Project not found',
				recoverable: true,
				guidance: ['Run: constellation index'],
				context: {
					tool: 'search_symbols',
					projectId: 'test-project',
					branchName: 'main',
					apiMethod: 'searchSymbols',
				},
				docs: 'https://docs.constellationdev.io/troubleshooting',
			},
			formattedMessage: 'Project not indexed',
		};
		expect(isMcpErrorResponse(response)).toBe(true);
	});

	it('should return false for success response', () => {
		const response = { success: true, data: {} };
		expect(isMcpErrorResponse(response)).toBe(false);
	});

	it('should return false for null', () => {
		expect(isMcpErrorResponse(null)).toBe(false);
	});

	it('should return false for undefined', () => {
		expect(isMcpErrorResponse(undefined)).toBe(false);
	});

	it('should return false for string', () => {
		expect(isMcpErrorResponse('error message')).toBe(false);
	});

	it('should return false for number', () => {
		expect(isMcpErrorResponse(500)).toBe(false);
	});

	it('should return false for array', () => {
		expect(isMcpErrorResponse([{ error: 'test' }])).toBe(false);
	});

	it('should return false for empty object', () => {
		expect(isMcpErrorResponse({})).toBe(false);
	});

	it('should return false for object without success field', () => {
		expect(isMcpErrorResponse({ error: { code: 'AUTH_ERROR' } })).toBe(false);
	});

	it('should return false for object without error field', () => {
		expect(isMcpErrorResponse({ success: false })).toBe(false);
	});

	it('should return false when success is not false', () => {
		expect(isMcpErrorResponse({ success: 'false', error: {} })).toBe(false);
	});

	it('should return false when error is not an object', () => {
		expect(isMcpErrorResponse({ success: false, error: 'string error' })).toBe(
			false,
		);
	});

	it('should return false when error is null', () => {
		expect(isMcpErrorResponse({ success: false, error: null })).toBe(false);
	});
});

describe('isRecoverableError', () => {
	describe('recoverable error codes', () => {
		it('should return true for AUTH_ERROR', () => {
			expect(isRecoverableError(ErrorCode.AUTH_ERROR)).toBe(true);
		});

		it('should return true for AUTHZ_ERROR', () => {
			expect(isRecoverableError(ErrorCode.AUTHZ_ERROR)).toBe(true);
		});

		it('should return true for AUTH_EXPIRED', () => {
			expect(isRecoverableError(ErrorCode.AUTH_EXPIRED)).toBe(true);
		});

		it('should return true for NOT_CONFIGURED', () => {
			expect(isRecoverableError(ErrorCode.NOT_CONFIGURED)).toBe(true);
		});

		it('should return true for PROJECT_NOT_INDEXED', () => {
			expect(isRecoverableError(ErrorCode.PROJECT_NOT_INDEXED)).toBe(true);
		});

		it('should return true for BRANCH_NOT_FOUND', () => {
			expect(isRecoverableError(ErrorCode.BRANCH_NOT_FOUND)).toBe(true);
		});

		it('should return true for STALE_INDEX', () => {
			expect(isRecoverableError(ErrorCode.STALE_INDEX)).toBe(true);
		});

		it('should return true for VALIDATION_ERROR', () => {
			expect(isRecoverableError(ErrorCode.VALIDATION_ERROR)).toBe(true);
		});

		it('should return true for MEMORY_EXCEEDED', () => {
			expect(isRecoverableError(ErrorCode.MEMORY_EXCEEDED)).toBe(true);
		});
	});

	describe('non-recoverable error codes', () => {
		it('should return false for TOOL_NOT_FOUND', () => {
			expect(isRecoverableError(ErrorCode.TOOL_NOT_FOUND)).toBe(false);
		});

		it('should return false for EXECUTION_ERROR', () => {
			expect(isRecoverableError(ErrorCode.EXECUTION_ERROR)).toBe(false);
		});

		it('should return false for INTERNAL_ERROR', () => {
			expect(isRecoverableError(ErrorCode.INTERNAL_ERROR)).toBe(false);
		});

		it('should return false for API_UNREACHABLE', () => {
			expect(isRecoverableError(ErrorCode.API_UNREACHABLE)).toBe(false);
		});

		it('should return false for SYMBOL_NOT_FOUND', () => {
			expect(isRecoverableError(ErrorCode.SYMBOL_NOT_FOUND)).toBe(false);
		});

		it('should return false for FILE_NOT_FOUND', () => {
			expect(isRecoverableError(ErrorCode.FILE_NOT_FOUND)).toBe(false);
		});

		it('should return false for EXECUTION_TIMEOUT', () => {
			expect(isRecoverableError(ErrorCode.EXECUTION_TIMEOUT)).toBe(false);
		});

		it('should return false for RATE_LIMITED', () => {
			expect(isRecoverableError(ErrorCode.RATE_LIMITED)).toBe(false);
		});

		it('should return false for SERVICE_UNAVAILABLE', () => {
			expect(isRecoverableError(ErrorCode.SERVICE_UNAVAILABLE)).toBe(false);
		});
	});

	it('should categorize all error codes', () => {
		const allCodes = Object.values(ErrorCode) as ErrorCodeType[];
		const recoverableCodes = allCodes.filter((code) =>
			isRecoverableError(code),
		);
		const nonRecoverableCodes = allCodes.filter(
			(code) => !isRecoverableError(code),
		);

		// Verify we've categorized all codes
		expect(recoverableCodes.length + nonRecoverableCodes.length).toBe(
			allCodes.length,
		);

		// Verify expected counts
		expect(recoverableCodes.length).toBe(9);
		expect(nonRecoverableCodes.length).toBe(9);
	});
});
