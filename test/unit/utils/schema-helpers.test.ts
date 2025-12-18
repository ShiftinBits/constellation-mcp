/**
 * Schema Helpers Tests
 */

import { describe, it, expect } from '@jest/globals';
import { booleanSchema } from '../../../src/utils/schema-helpers.js';

describe('booleanSchema', () => {
	describe('string input conversion', () => {
		it('should convert "true" string to true boolean', () => {
			const result = booleanSchema.parse('true');
			expect(result).toBe(true);
		});

		it('should convert "false" string to false boolean', () => {
			const result = booleanSchema.parse('false');
			expect(result).toBe(false);
		});

		it('should convert "TRUE" (uppercase) to true', () => {
			const result = booleanSchema.parse('TRUE');
			expect(result).toBe(true);
		});

		it('should convert "FALSE" (uppercase) to false', () => {
			const result = booleanSchema.parse('FALSE');
			expect(result).toBe(false);
		});

		it('should convert "True" (mixed case) to true', () => {
			const result = booleanSchema.parse('True');
			expect(result).toBe(true);
		});

		it('should convert any non-true string to false', () => {
			// This is the key behavior - only exact "true" (case-insensitive) is truthy
			const result = booleanSchema.parse('yes');
			expect(result).toBe(false);
		});
	});

	describe('boolean input passthrough', () => {
		it('should pass through true boolean unchanged', () => {
			const result = booleanSchema.parse(true);
			expect(result).toBe(true);
		});

		it('should pass through false boolean unchanged', () => {
			const result = booleanSchema.parse(false);
			expect(result).toBe(false);
		});
	});

	describe('validation errors', () => {
		it('should throw error for number input', () => {
			expect(() => booleanSchema.parse(1)).toThrow();
		});

		it('should throw error for null input', () => {
			expect(() => booleanSchema.parse(null)).toThrow();
		});

		it('should throw error for undefined input', () => {
			expect(() => booleanSchema.parse(undefined)).toThrow();
		});

		it('should throw error for object input', () => {
			expect(() => booleanSchema.parse({})).toThrow();
		});

		it('should throw error for array input', () => {
			expect(() => booleanSchema.parse([])).toThrow();
		});
	});

	describe('MCP framework bug prevention', () => {
		// These tests verify the fix for the MCP framework bug where
		// string booleans are sent instead of actual booleans

		it('should correctly handle "false" string (MCP framework sends this)', () => {
			// The bug: Boolean("false") === true in JavaScript
			// Our fix: "false".toLowerCase() === "true" returns false
			const result = booleanSchema.parse('false');
			expect(result).toBe(false); // Not true!
		});

		it('should correctly handle "true" string (MCP framework sends this)', () => {
			const result = booleanSchema.parse('true');
			expect(result).toBe(true);
		});
	});
});
