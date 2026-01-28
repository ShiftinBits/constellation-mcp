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

		it('should reference query_code_graph tool and api object', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('query_code_graph');
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

		it('should include proactive usage guidance with decision heuristic', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('designed for YOU');
			expect(instructions).toContain('PROACTIVELY');
			expect(instructions).toContain('Decision rule');
			expect(instructions).toContain('Use Grep/Glob for');
		});

		it('should include return shapes in method reference', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Returns');
			// Verify key return shapes are present
			expect(instructions).toContain('{symbols:');
			expect(instructions).toContain('breakingChangeRisk');
			expect(instructions).toContain('orphanedSymbols');
		});

		it('should include error handling and availability guidance', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Errors are structured');
			expect(instructions).toContain('guidance[]');
			expect(instructions).toContain('api.ping()');
			expect(instructions).toContain('api.getCapabilities()');
		});

		it('should include chained workflow example with Promise.all', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain(
				'api.impactAnalysis({ symbolId: symbols[0].id })',
			);
			expect(instructions).toContain(
				'api.getDependents({ filePath: symbols[0].filePath })',
			);
		});

		it('should not contain template placeholders', () => {
			const instructions = getServerInstructions();
			// Check for Handlebars/Mustache-style template placeholders (e.g., {{ variable }})
			// but not JSON-like return shapes (e.g., {symbols: [{id}]})
			expect(instructions).not.toMatch(/\{\{\s*\w+/);
			expect(instructions).not.toContain('TODO');
			expect(instructions).not.toContain('FIXME');
		});

		it('should include recipes section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Recipes');
		});

		it('should be concise (under 5000 chars)', () => {
			const instructions = getServerInstructions();
			// Enhanced instructions with return shapes, decision heuristic, recipes, and availability guidance
			expect(instructions.length).toBeLessThan(5000);
			expect(instructions.length).toBeGreaterThan(1000);
		});
	});
});
