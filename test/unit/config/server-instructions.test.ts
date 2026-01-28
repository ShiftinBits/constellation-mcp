/**
 * Server Instructions Unit Tests
 *
 * Tests the getServerInstructions function that provides
 * usage guidance to AI assistants about Constellation Code Mode.
 */

import { describe, it, expect } from '@jest/globals';
import { getServerInstructions } from '../../../src/config/server-instructions.js';

describe('server-instructions', () => {
	describe('getServerInstructions', () => {
		it('should return a non-empty string', () => {
			const instructions = getServerInstructions();
			expect(typeof instructions).toBe('string');
			expect(instructions.length).toBeGreaterThan(0);
		});

		it('should include the main header for Code Mode', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('# Constellation Code Mode');
		});

		it('should reference query_code tool and api object', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('query_code');
			expect(instructions).toContain('api');
		});

		it('should include critical rules', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('await');
			expect(instructions).toContain('return');
			expect(instructions).toContain('Promise.all()');
		});

		it('should include method reference table', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Method Reference');
			expect(instructions).toContain('searchSymbols');
			expect(instructions).toContain('getDependents');
			expect(instructions).toContain('impactAnalysis');
		});

		it('should include quick start example', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Quick Start');
			expect(instructions).toContain('api.searchSymbols');
		});

		it('should mention api.listMethods() for discovery', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('api.listMethods()');
		});

		it('should mention type resources', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('constellation://types/api');
		});

		it('should include multi-project workspace guidance', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('cwd');
			expect(instructions).toContain('monorepo');
		});

		it('should return trimmed output without leading/trailing whitespace', () => {
			const instructions = getServerInstructions();
			expect(instructions).toBe(instructions.trim());
			expect(instructions.startsWith('<IMPORTANT>')).toBe(true);
		});

		it('should include proactive usage guidance', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('designed for YOU');
			expect(instructions).toContain('PROACTIVELY');
			expect(instructions).toContain("don't wait for the human to ask");
		});

		it('should not contain template placeholders', () => {
			const instructions = getServerInstructions();
			expect(instructions).not.toContain('{{');
			expect(instructions).not.toContain('}}');
			expect(instructions).not.toContain('TODO');
			expect(instructions).not.toContain('FIXME');
		});

		it('should be concise (under 2500 chars)', () => {
			const instructions = getServerInstructions();
			// Simplified instructions with proactive guidance, under 2500 chars
			expect(instructions.length).toBeLessThan(2500);
			expect(instructions.length).toBeGreaterThan(500);
		});
	});
});
