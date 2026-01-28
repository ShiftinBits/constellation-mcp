/**
 * Server Instructions Unit Tests
 *
 * Tests the getServerInstructions function that provides
 * comprehensive guidance to AI assistants about Constellation Code Mode.
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
			expect(instructions).toContain('# Constellation MCP Server - Code Mode');
		});

		it('should reference execute_code tool and api object', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('execute_code');
			expect(instructions).toContain('api');
		});

		it('should include critical rules', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('await');
			expect(instructions).toContain('return');
			expect(instructions).toContain('Promise.all()');
			expect(instructions).toContain('auto-returned');
		});

		it('should distinguish Constellation from source code tools', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('relationships');
			expect(instructions).toContain('Read');
		});

		it('should include activation table with intent-to-method mapping', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## ACTIVATION RULES');
			expect(instructions).toContain('Where is X defined');
			expect(instructions).toContain('searchSymbols()');
			expect(instructions).toContain('api.search(');
		});

		it('should include fallback guidance', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('Fallback');
			expect(instructions).toContain('Grep');
			expect(instructions).toContain('constellation index');
		});

		it('should include JavaScript code examples for each use case', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('api.searchSymbols');
			expect(instructions).toContain('api.getDependencies');
			expect(instructions).toContain('api.impactAnalysis');
			expect(instructions).toContain('api.getArchitectureOverview');
			expect(instructions).toContain('api.findOrphanedCode');
		});

		it('should include patterns zone', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Patterns');
			expect(instructions).toContain('Chained Analysis');
			expect(instructions).toContain('Error Handling');
		});

		it('should include best practices reference', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Best Practices');
			expect(instructions).toContain('symbolId');
			expect(instructions).toContain('Parallel');
			expect(instructions).toContain('Filtering');
		});

		it('should include API reference table with Returns column', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## API Reference');
			expect(instructions).toContain(
				'| Method | Parameters | Returns | Use When |',
			);
			expect(instructions).toContain('api.searchSymbols()');
			expect(instructions).toContain('api.getSymbolDetails()');
			expect(instructions).toContain('api.getDependencies()');
			expect(instructions).toContain('api.getDependents()');
			expect(instructions).toContain('api.traceSymbolUsage()');
			expect(instructions).toContain('api.getCallGraph()');
			expect(instructions).toContain('api.impactAnalysis()');
			expect(instructions).toContain('api.findCircularDependencies()');
			expect(instructions).toContain('api.findOrphanedCode()');
			expect(instructions).toContain('api.getArchitectureOverview()');
			expect(instructions).toContain('symbols[], pagination?');
			expect(instructions).toContain('breakingChangeRisk');
		});

		it('should document per-method type resources', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('constellation://types/api/{methodName}');
			expect(instructions).toContain('constellation://types/api/searchSymbols');
		});

		it('should document type access hierarchy', () => {
			const instructions = getServerInstructions();
			const returnsIdx = instructions.indexOf('| Returns |');
			const typeDefsIdx = instructions.indexOf('## Type Definitions');
			expect(returnsIdx).toBeLessThan(typeDefsIdx);
		});

		it('should return trimmed output without leading/trailing whitespace', () => {
			const instructions = getServerInstructions();
			expect(instructions).toBe(instructions.trim());
			expect(instructions.startsWith('#')).toBe(true);
		});

		it('should mention depth parameter best practices', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('depth=1');
			expect(instructions).toContain('EXPONENTIALLY');
		});

		it('should mention excludeTests filter option', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('excludeTests=true');
		});

		it('should not contain template placeholders', () => {
			const instructions = getServerInstructions();
			expect(instructions).not.toContain('{{');
			expect(instructions).not.toContain('}}');
			expect(instructions).not.toContain('TODO');
			expect(instructions).not.toContain('FIXME');
		});

		it('should provide substantial content', () => {
			const instructions = getServerInstructions();
			// Should be comprehensive guide - at least 3000 chars
			expect(instructions.length).toBeGreaterThan(3000);
		});

		it('should follow activation-first zone structure', () => {
			const instructions = getServerInstructions();
			const activationIdx = instructions.indexOf('## ACTIVATION RULES');
			const patternsIdx = instructions.indexOf('## Patterns');
			const referenceIdx = instructions.indexOf('## API Reference');
			expect(activationIdx).toBeLessThan(patternsIdx);
			expect(patternsIdx).toBeLessThan(referenceIdx);
		});

		it('should include shorthand aliases in activation table', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('api.search(');
			expect(instructions).toContain('api.deps(');
			expect(instructions).toContain('api.impact(');
		});
	});
});
