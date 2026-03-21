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
			expect(instructions.startsWith('<IMPORTANT>')).toBe(true);
		});

		it('should include proactive usage guidance in IMPORTANT block', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('designed for YOU');
			expect(instructions).toContain('DEFAULT for code structure questions');
			expect(instructions).toContain('BEFORE reaching for Grep/Glob');
		});

		it('should include instinct-override psychological trigger', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain(
				'When your instinct says "I\'ll just grep for this"',
			);
		});

		it('should include first-time guidance with graceful fallback', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('First-time?');
			expect(instructions).toContain('getCapabilities()');
			expect(instructions).toContain('guidance[]');
		});

		it('should include getCapabilities() first-time guidance in IMPORTANT block', () => {
			const instructions = getServerInstructions();
			const importantMatch = instructions.match(
				/<IMPORTANT>([\s\S]*?)<\/IMPORTANT>/,
			);
			expect(importantMatch).not.toBeNull();
			const importantBlock = importantMatch![1];
			expect(importantBlock).toContain('api.getCapabilities()');
			expect(importantBlock).toContain('First-time?');
		});

		it('should not contain template placeholders', () => {
			const instructions = getServerInstructions();
			expect(instructions).not.toMatch(/\{\{\s*\w+/);
			expect(instructions).not.toContain('TODO');
			expect(instructions).not.toContain('FIXME');
		});

		it('should include top 3 workflow quick-reference', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Top 3 Workflow');
			expect(instructions).toContain('searchSymbols({query})');
			expect(instructions).toContain('impactAnalysis({symbolId})');
			expect(instructions).toContain('getDependents({filePath})');
		});

		it('should mention getCapabilities() for pre-flight checking', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('api.getCapabilities()');
			expect(instructions).toContain('isIndexed');
		});

		it('should include query performance note', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Performance');
			expect(instructions).toContain('200ms');
		});

		it('should include limit heuristics in rules', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('limit: 10');
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
			expect(instructions).toContain('git root');
		});

		it('should include cwd requirement in rules section', () => {
			const instructions = getServerInstructions();
			const rulesSection = instructions.substring(
				instructions.indexOf('## Rules'),
			);
			expect(rulesSection).toContain('cwd');
			expect(rulesSection).toContain('Required');
		});

		it('should include error handling and availability guidance', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Errors are structured');
			expect(instructions).toContain('guidance[]');
			expect(instructions).toContain('api.ping()');
			expect(instructions).toContain('getCapabilities()');
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

		it('should have IMPORTANT block focused on HOW not WHEN', () => {
			const instructions = getServerInstructions();
			const importantMatch = instructions.match(
				/<IMPORTANT>([\s\S]*?)<\/IMPORTANT>/,
			);
			expect(importantMatch).not.toBeNull();
			const importantBlock = importantMatch![1];

			// HOW guidance (should be present)
			expect(importantBlock).toContain('designed for YOU');
			expect(importantBlock).toContain('DEFAULT for code structure questions');
			expect(importantBlock).toContain('instinct says');

			// WHEN guidance (should NOT be present — it's in tool description)
			expect(importantBlock).not.toContain('| Task | Best Tool |');
			expect(importantBlock).not.toContain('WRONG TOOL SIGNAL');
		});
	});
});
