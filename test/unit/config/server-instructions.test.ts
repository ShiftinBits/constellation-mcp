/**
 * Server Instructions Unit Tests
 *
 * Tests the getServerInstructions function that provides
 * usage guidance to AI assistants about Constellation Code Mode.
 *
 * NOTE: Reference content (method tables, response shapes, recipes, recovery patterns)
 * has been moved to the code-mode-guide.ts resource. Tests for that content are in
 * code-mode-guide.test.ts. These tests verify the trimmed essential instructions only.
 */

import { describe, expect, it } from '@jest/globals';
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

		it('should reference code_intel tool and api object', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('code_intel');
			expect(instructions).toContain('api');
		});

		it('should include critical rules', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('await');
			expect(instructions).toContain('return');
			expect(instructions).toContain('Promise.all()');
		});

		it('should include quick start example', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Quick Start');
			expect(instructions).toContain('api.searchSymbols');
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

		it('should return trimmed output without leading/trailing whitespace', () => {
			const instructions = getServerInstructions();
			expect(instructions).toBe(instructions.trim());
			expect(instructions.startsWith('<CRITICAL>')).toBe(true);
		});

		it('should include CRITICAL block with decision rule', () => {
			const instructions = getServerInstructions();
			const criticalMatch = instructions.match(
				/<CRITICAL>([\s\S]*?)<\/CRITICAL>/,
			);
			expect(criticalMatch).not.toBeNull();
			const criticalBlock = criticalMatch![1];

			// Three-part structure: rule, rationale, exceptions
			expect(criticalBlock).toContain('symbol name');
			expect(criticalBlock).toContain('even if you already know the file');
			expect(criticalBlock).toContain('Why:');
			expect(criticalBlock).toContain('Grep exceptions');
		});

		it('should include decision rule rationale', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('cross-file relationships');
			expect(instructions).toContain('transitive dependencies');
		});

		it('should include explicit Grep exceptions', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('error messages');
			expect(instructions).toContain('config values');
			expect(instructions).toContain('Never for symbol names');
		});

		it('should not contain template placeholders', () => {
			const instructions = getServerInstructions();
			expect(instructions).not.toMatch(/\{\{\s*\w+/);
			expect(instructions).not.toContain('TODO');
			expect(instructions).not.toContain('FIXME');
		});

		it('should mention getCapabilities() for pre-flight checking', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('getCapabilities()');
			expect(instructions).toContain('indexing status');
		});

		it('should include limit heuristics in rules', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('limit: 50');
		});

		it('should include cwd requirement guidance', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('cwd');
			expect(instructions).toContain('Required');
		});

		it('should clarify cwd requirement and project directory', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('project directory');
			expect(instructions).toContain('Required');
			expect(instructions).toContain('cwd');
		});

		it('should include error handling guidance', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Errors');
			expect(instructions).toContain('guidance[]');
			expect(instructions).toContain('resultContext.reason');
		});

		it('should include pointer to constellation://docs/guide', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('constellation://docs/guide');
		});

		it('should mention api.listMethods() or guide resource for discovery', () => {
			const instructions = getServerInstructions();
			// Instructions point to the guide resource for full method reference
			expect(instructions).toContain('constellation://docs/guide');
		});

		it('should be concise (under 5500 chars / ~1,375 tokens)', () => {
			const instructions = getServerInstructions();
			// Target: ~4,800 chars / ~1,200 tokens after progressive disclosure refactor
			expect(instructions.length).toBeLessThan(5500);
			expect(instructions.length).toBeGreaterThan(1000);
		});

		it('should NOT contain content moved to guide resource', () => {
			const instructions = getServerInstructions();
			// These sections are now in constellation://docs/guide
			expect(instructions).not.toContain('## Which Method?');
			expect(instructions).not.toContain('## Response Contract');
			expect(instructions).not.toContain('## Empty Results?');
			expect(instructions).not.toContain('## Method Reference');
			expect(instructions).not.toContain('## Recipes');
			expect(instructions).not.toContain('## Recovery Patterns');
		});

		it('should NOT contain routing logic duplicated from tool description', () => {
			const instructions = getServerInstructions();
			// These are now only in the tool description (query-code-graph-tool.ts)
			expect(instructions).not.toContain('WRONG TOOL SIGNAL');
			expect(instructions).not.toContain("DON'T use code_intel for:");
			expect(instructions).not.toContain('| Best Tool |');
		});

		it('should have CRITICAL block focused on decision rule not routing', () => {
			const instructions = getServerInstructions();
			const criticalMatch = instructions.match(
				/<CRITICAL>([\s\S]*?)<\/CRITICAL>/,
			);
			expect(criticalMatch).not.toBeNull();
			const criticalBlock = criticalMatch![1];

			// Decision rule content (should be present)
			expect(criticalBlock).toContain('decision rule');
			expect(criticalBlock).toContain('symbol name');
			expect(criticalBlock).toContain('Why:');
			expect(criticalBlock).toContain('Grep exceptions');

			// Routing guidance (should NOT be present — it's in tool description)
			expect(criticalBlock).not.toContain('| Task | Best Tool |');
			expect(criticalBlock).not.toContain('WRONG TOOL SIGNAL');
		});
	});
});
