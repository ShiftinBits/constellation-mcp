/**
 * AuditLogger Unit Tests (SB-258 Step 3.4)
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from '@jest/globals';
import {
	AuditLogger,
	type AuditEntry,
} from '../../../src/utils/audit-logger.js';

describe('AuditLogger', () => {
	let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
	const originalEnv = process.env.CONSTELLATION_AUDIT_LOG;

	beforeEach(() => {
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		delete process.env.CONSTELLATION_AUDIT_LOG;
		AuditLogger.reset();
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		if (originalEnv !== undefined) {
			process.env.CONSTELLATION_AUDIT_LOG = originalEnv;
		} else {
			delete process.env.CONSTELLATION_AUDIT_LOG;
		}
	});

	describe('singleton', () => {
		it('should return the same instance', () => {
			const a = AuditLogger.get();
			const b = AuditLogger.get();
			expect(a).toBe(b);
		});
	});

	describe('disabled by default', () => {
		it('should not log when env var is not set', () => {
			const logger = AuditLogger.get();
			logger.log({
				timestamp: new Date().toISOString(),
				event: 'execution_start',
			});
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		it('should report disabled via isEnabled()', () => {
			expect(AuditLogger.get().isEnabled()).toBe(false);
		});
	});

	describe('enabled via env var', () => {
		beforeEach(() => {
			process.env.CONSTELLATION_AUDIT_LOG = 'true';
			AuditLogger.reset();
		});

		it('should report enabled via isEnabled()', () => {
			expect(AuditLogger.get().isEnabled()).toBe(true);
		});

		it('should log structured JSON to stderr', () => {
			const entry: AuditEntry = {
				timestamp: '2026-01-01T00:00:00.000Z',
				event: 'execution_start',
				code: 'const x = 1;',
			};
			AuditLogger.get().log(entry);

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			const output = consoleErrorSpy.mock.calls[0][0] as string;
			const parsed = JSON.parse(output);
			expect(parsed.audit).toBe(true);
			expect(parsed.event).toBe('execution_start');
			expect(parsed.code).toBe('const x = 1;');
			expect(parsed.timestamp).toBe('2026-01-01T00:00:00.000Z');
		});

		it('should log all event types', () => {
			const events: AuditEntry['event'][] = [
				'execution_start',
				'execution_end',
				'api_call',
				'validation_failure',
				'error',
			];

			for (const event of events) {
				AuditLogger.get().log({
					timestamp: new Date().toISOString(),
					event,
				});
			}

			expect(consoleErrorSpy).toHaveBeenCalledTimes(5);
		});

		it('should include optional fields when provided', () => {
			AuditLogger.get().log({
				timestamp: '2026-01-01T00:00:00.000Z',
				event: 'api_call',
				method: 'search_symbols',
				duration: 150,
				success: true,
				resultSize: 2048,
			});

			const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
			expect(parsed.method).toBe('search_symbols');
			expect(parsed.duration).toBe(150);
			expect(parsed.success).toBe(true);
			expect(parsed.resultSize).toBe(2048);
		});

		it('should truncate code at 500 characters', () => {
			const longCode = 'a'.repeat(1000);
			AuditLogger.get().log({
				timestamp: '2026-01-01T00:00:00.000Z',
				event: 'execution_start',
				code: longCode,
			});

			const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
			expect(parsed.code.length).toBe(503); // 500 + '...'
			expect(parsed.code.endsWith('...')).toBe(true);
		});

		it('should not truncate code under 500 characters', () => {
			const shortCode = 'a'.repeat(499);
			AuditLogger.get().log({
				timestamp: '2026-01-01T00:00:00.000Z',
				event: 'execution_start',
				code: shortCode,
			});

			const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
			expect(parsed.code).toBe(shortCode);
		});

		it('should include error field for error events', () => {
			AuditLogger.get().log({
				timestamp: '2026-01-01T00:00:00.000Z',
				event: 'error',
				error: 'Script execution timed out',
				duration: 30000,
			});

			const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
			expect(parsed.error).toBe('Script execution timed out');
		});
	});

	describe('not enabled with wrong value', () => {
		it('should not log when env var is set to non-true value', () => {
			process.env.CONSTELLATION_AUDIT_LOG = 'false';
			AuditLogger.reset();

			AuditLogger.get().log({
				timestamp: new Date().toISOString(),
				event: 'execution_start',
			});
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});
	});
});
