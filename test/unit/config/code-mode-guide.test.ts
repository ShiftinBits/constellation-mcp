/**
 * Code Mode Guide Unit Tests
 *
 * Tests the getCodeModeGuide function that provides
 * on-demand reference material for AI assistants via constellation://docs/guide.
 */

import { describe, expect, it } from '@jest/globals';
import {
	getCodeModeGuide,
	GUIDE_SECTIONS,
} from '../../../src/config/code-mode-guide.js';

describe('code-mode-guide', () => {
	describe('getCodeModeGuide', () => {
		it('should return a non-empty string', () => {
			const guide = getCodeModeGuide();
			expect(typeof guide).toBe('string');
			expect(guide.length).toBeGreaterThan(0);
		});

		it('should include the main header', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('# Code Mode Usage Guide');
		});

		it('should return trimmed output without leading/trailing whitespace', () => {
			const guide = getCodeModeGuide();
			expect(guide).toBe(guide.trim());
		});

		it('should include "Which Method?" table with all 9 method mappings', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('## Which Method?');
			expect(guide).toContain('searchSymbols');
			expect(guide).toContain('getCallGraph');
			expect(guide).toContain('getDependencies');
			expect(guide).toContain('getDependents');
			expect(guide).toContain('impactAnalysis');
			expect(guide).toContain('traceSymbolUsage');
			expect(guide).toContain('findOrphanedCode');
			expect(guide).toContain('getArchitectureOverview');
		});

		it('should include "What uses X?" disambiguation section', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('### "What uses X?" — Choosing the Right Method');
			expect(guide).toContain('getDependents');
			expect(guide).toContain('getCallGraph');
			expect(guide).toContain('traceSymbolUsage');
		});

		it('should include Response Contract with success, empty, and error shapes', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('## Response Contract');
			expect(guide).toContain('success: true');
			expect(guide).toContain('success: false');
			expect(guide).toContain('resultContext');
		});

		it('should include Top 3 Method Response Shapes', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('### Top 3 Method Response Shapes');
			expect(guide).toContain('searchSymbols');
			expect(guide).toContain('impactAnalysis');
			expect(guide).toContain('getDependents');
			expect(guide).toContain('breakingChangeRisk');
			expect(guide).toContain('directDependents');
		});

		it('should include "Empty Results?" diagnostic section', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('## Empty Results?');
			expect(guide).toContain('resultContext.reason');
			expect(guide).toContain('constellation index');
		});

		it('should include Method Reference table with all 12 methods', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('## Method Reference');
			const methods = [
				'searchSymbols',
				'getSymbolDetails',
				'getDependencies',
				'getDependents',
				'impactAnalysis',
				'findOrphanedCode',
				'getArchitectureOverview',
				'traceSymbolUsage',
				'getCallGraph',
				'findCircularDependencies',
				'ping',
				'getCapabilities',
			];
			for (const method of methods) {
				expect(guide).toContain(method);
			}
		});

		it('should include return shapes in Method Reference', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('{symbols:');
			expect(guide).toContain('breakingChangeRisk');
			expect(guide).toContain('orphanedSymbols');
		});

		it('should include Recipes section with named workflows', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('## Recipes');
			expect(guide).toContain('Safe to Change?');
			expect(guide).toContain('Understand This Codebase');
		});

		it('should include Recovery Patterns with error codes', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('## Recovery Patterns');
			expect(guide).toContain('guidance[]');
			expect(guide).toContain('suggestedCode');
			expect(guide).toContain('alternativeApproach');
			expect(guide).toContain('recoverable');
			expect(guide).toContain('AUTH_ERROR');
			expect(guide).toContain('PROJECT_NOT_INDEXED');
			expect(guide).toContain('SYMBOL_NOT_FOUND');
			expect(guide).toContain('EXECUTION_TIMEOUT');
		});

		it('should reference api.listMethods() and type resources', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('api.listMethods()');
			expect(guide).toContain('constellation://types/api/{method}');
		});

		it('should document isExported parameter', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('isExported');
		});

		it('should not contain template placeholders', () => {
			const guide = getCodeModeGuide();
			expect(guide).not.toMatch(/\{\{\s*\w+/);
			expect(guide).not.toContain('TODO');
			expect(guide).not.toContain('FIXME');
		});

		it('should order sections logically', () => {
			const guide = getCodeModeGuide();
			// Sections are grouped by sub-resource:
			// Methods: Which Method? → Method Reference
			// Recipes: Response Contract → Recipes
			// Recovery: Common Mistakes → Empty Results? → Recovery Patterns
			const whichMethodIdx = guide.indexOf('## Which Method?');
			const methodRefIdx = guide.indexOf('## Method Reference');
			const responseContractIdx = guide.indexOf('## Response Contract');
			const recipesIdx = guide.indexOf('## Recipes');
			const commonMistakesIdx = guide.indexOf('## Common Mistakes');
			const emptyResultsIdx = guide.indexOf('## Empty Results?');
			const recoveryIdx = guide.indexOf('## Recovery Patterns');

			// Methods section comes first
			expect(whichMethodIdx).toBeLessThan(methodRefIdx);
			// Recipes section comes after methods
			expect(methodRefIdx).toBeLessThan(responseContractIdx);
			expect(responseContractIdx).toBeLessThan(recipesIdx);
			// Recovery section comes last
			expect(recipesIdx).toBeLessThan(commonMistakesIdx);
			expect(commonMistakesIdx).toBeLessThan(emptyResultsIdx);
			expect(emptyResultsIdx).toBeLessThan(recoveryIdx);
		});

		it('should include sub-resource tip', () => {
			const guide = getCodeModeGuide();
			expect(guide).toContain('constellation://docs/guide/methods');
			expect(guide).toContain('constellation://docs/guide/recipes');
			expect(guide).toContain('constellation://docs/guide/recovery');
		});
	});

	describe('GUIDE_SECTIONS', () => {
		it('should export 3 sections: methods, recipes, recovery', () => {
			expect(Object.keys(GUIDE_SECTIONS)).toEqual([
				'methods',
				'recipes',
				'recovery',
			]);
		});

		it('should have name, description, and getter for each section', () => {
			for (const [key, section] of Object.entries(GUIDE_SECTIONS)) {
				expect(section.name).toBeTruthy();
				expect(section.description).toBeTruthy();
				expect(typeof section.getter).toBe('function');
				const content = section.getter();
				expect(typeof content).toBe('string');
				expect(content.length).toBeGreaterThan(0);
			}
		});

		it('methods section should include method reference and disambiguation', () => {
			const content = GUIDE_SECTIONS.methods.getter();
			expect(content).toContain('## Which Method?');
			expect(content).toContain('## Method Reference');
			expect(content).toContain('"What uses X?"');
		});

		it('recipes section should include response contract and workflows', () => {
			const content = GUIDE_SECTIONS.recipes.getter();
			expect(content).toContain('## Response Contract');
			expect(content).toContain('## Recipes');
			expect(content).toContain('Safe to Change?');
		});

		it('recovery section should include common mistakes and recovery patterns', () => {
			const content = GUIDE_SECTIONS.recovery.getter();
			expect(content).toContain('## Common Mistakes');
			expect(content).toContain('## Empty Results?');
			expect(content).toContain('## Recovery Patterns');
			expect(content).toContain('AUTH_ERROR');
		});

		it('each section should be smaller than the full guide', () => {
			const fullGuide = getCodeModeGuide();
			for (const section of Object.values(GUIDE_SECTIONS)) {
				expect(section.getter().length).toBeLessThan(fullGuide.length);
			}
		});
	});
});
