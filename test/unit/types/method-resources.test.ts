import { describe, it, expect } from '@jest/globals';
import {
	METHOD_SUMMARIES,
	resolveMethodName,
} from '../../../src/types/method-summaries.js';

/**
 * Tests for per-method resource content resolution.
 * Integration with MCP server resource registration is validated via npm run inspector.
 * These tests verify the data layer that powers the resources.
 */
describe('per-method resource resolution', () => {
	it('should resolve all canonical method names to summaries', () => {
		for (const methodName of Object.keys(METHOD_SUMMARIES)) {
			const resolved = resolveMethodName(methodName);
			expect(resolved).not.toBeNull();
			expect(METHOD_SUMMARIES[resolved!]).toBeDefined();
		}
	});

	it('should return null for unknown method names', () => {
		expect(resolveMethodName('unknown')).toBeNull();
		expect(resolveMethodName('foo')).toBeNull();
	});
});
