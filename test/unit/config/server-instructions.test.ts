/**
 * Server Instructions Unit Tests
 *
 * Tests the getServerInstructions function that provides
 * usage guidance to AI assistants about Constellation Code Mode.
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

		it('should have a reference section separator', () => {
			const instructions = getServerInstructions();
			// The instructions should visually separate Essential from Reference content
			expect(instructions).toContain('\n---\n');
		});

		it('should order essential content before reference content', () => {
			const instructions = getServerInstructions();
			const topWorkflowIdx = instructions.indexOf('## Top 3 Workflow');
			const separatorIdx = instructions.indexOf('\n---\n');
			const methodRefIdx = instructions.indexOf('## Method Reference');
			expect(topWorkflowIdx).toBeLessThan(separatorIdx);
			expect(separatorIdx).toBeLessThan(methodRefIdx);
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
			expect(instructions).toContain('Best Tool');
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
			// getCapabilities() appears in IMPORTANT block and Rule 0 as api.getCapabilities(),
			// and in Method Reference without the api. prefix
			expect(instructions).toContain('getCapabilities()');
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

		it('should include named workflow recipes', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Safe to Change?');
			expect(instructions).toContain('Understand This Codebase');
			expect(instructions).toContain('Find Dead Code');
		});

		it('should include recovery patterns section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Recovery Patterns');
			expect(instructions).toContain('guidance[]');
			expect(instructions).toContain('suggestedCode');
			expect(instructions).toContain('alternativeApproach');
			expect(instructions).toContain('recoverable');
			expect(instructions).toContain('AUTH_ERROR');
			expect(instructions).toContain('PROJECT_NOT_INDEXED');
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

		it('should describe searchSymbols query matching behavior', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('searchSymbols');
			expect(instructions).toContain('substring');
		});

		it('should clarify cwd default behavior', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Default:');
			expect(instructions).toContain('git root');
		});

		it('should include tool routing guidance in decision table', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('literal string');
			expect(instructions).toContain('config values');
			expect(instructions).toContain('Find files by name pattern');
		});

		it('should map tasks to correct tools in decision table', () => {
			const instructions = getServerInstructions();
			// Verify the decision table maps tasks to tools
			expect(instructions).toContain('| Read/view source code | Read |');
			expect(instructions).toContain('| Find files by name pattern | Glob |');
			expect(instructions).toContain('| Search for a literal string | Grep |');
		});

		it('should be concise (under 10500 chars)', () => {
			const instructions = getServerInstructions();
			// Raised to 10500 to accommodate workflow templates and JS justification section.
			expect(instructions.length).toBeLessThan(10500);
			expect(instructions.length).toBeGreaterThan(1000);
		});

		it('should include "Which Method?" quick selector', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Which Method?');
			expect(instructions).toContain('searchSymbols');
			expect(instructions).toContain('getCallGraph');
			expect(instructions).toContain('findOrphanedCode');
		});

		it('should include "Empty Results?" diagnostic section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Empty Results?');
			expect(instructions).toContain('resultContext.reason');
			expect(instructions).toContain('constellation index');
		});

		it('should include cross-tool workflow guidance in IMPORTANT block', () => {
			const instructions = getServerInstructions();
			const importantMatch = instructions.match(
				/<IMPORTANT>([\s\S]*?)<\/IMPORTANT>/,
			);
			expect(importantMatch).not.toBeNull();
			expect(importantMatch![1]).toContain('Read to view source');
		});

		it('should include limit heuristics in rules', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('limit: 10');
			expect(instructions).toContain('limit: 50');
		});

		it('should document isExported parameter in method reference', () => {
			const instructions = getServerInstructions();
			// isExported is documented in the Method Reference table
			expect(instructions).toContain('isExported');
			// No transformation - Core accepts isExported directly
			expect(instructions).not.toContain('filterByExported');
		});

		it('should order Which Method before Response Contract', () => {
			const instructions = getServerInstructions();
			const whichMethodIdx = instructions.indexOf('## Which Method?');
			const responseContractIdx = instructions.indexOf('## Response Contract');
			expect(whichMethodIdx).toBeGreaterThan(0);
			expect(whichMethodIdx).toBeLessThan(responseContractIdx);
		});
	});
});
