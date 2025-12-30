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

		it('should explain how Code Mode works', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## How Code Mode Works');
			expect(instructions).toContain('execute_code');
			expect(instructions).toContain('api');
		});

		it('should include key principles for Code Mode', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('### Key Principles');
			expect(instructions).toContain('await');
			expect(instructions).toContain('return');
			expect(instructions).toContain('Promise.all()');
		});

		it('should include core principle section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Core Principle');
			expect(instructions).toContain(
				'Constellation = Code Metadata & Relationships',
			);
		});

		it('should include when to use section with proactive triggers', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain(
				'## When to Use Constellation (Proactive)',
			);
			expect(instructions).toContain('**Discovery**');
			expect(instructions).toContain('**Dependencies**');
			expect(instructions).toContain('**Impact Analysis**');
			expect(instructions).toContain('**Architecture**');
			expect(instructions).toContain('**Code Quality**');
		});

		it('should include JavaScript code examples for each use case', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('api.searchSymbols');
			expect(instructions).toContain('api.getDependencies');
			expect(instructions).toContain('api.impactAnalysis');
			expect(instructions).toContain('api.getArchitectureOverview');
			expect(instructions).toContain('api.findOrphanedCode');
		});

		it('should include when NOT to use section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## When NOT to Use');
			expect(instructions).toContain('Reading source code');
			expect(instructions).toContain('Modifying files');
			expect(instructions).toContain('Running commands');
		});

		it('should include API reference table', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## API Reference');
			expect(instructions).toContain('| Method | Parameters | Use When |');
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
		});

		it('should include common patterns section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Common Patterns');
			expect(instructions).toContain('### Chained Analysis');
			expect(instructions).toContain('### Error Handling');
		});

		it('should include best practices section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Best Practices');
			expect(instructions).toContain('### Start Small, Escalate');
			expect(instructions).toContain('### Use symbolId');
			expect(instructions).toContain('### Parallel Execution');
			expect(instructions).toContain('### Filter Appropriately');
		});

		it('should include semantic markers section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Semantic Markers');
			expect(instructions).toContain('[EXPORTED]');
			expect(instructions).toContain('[INTERNAL]');
			expect(instructions).toContain('[TEST]');
			expect(instructions).toContain('[UNUSED]');
			expect(instructions).toContain('[HEAVILY_USED]');
			expect(instructions).toContain('[HIGH_IMPACT]');
		});

		it('should include quick decision matrix', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Quick Decision Matrix');
			expect(instructions).toContain('| Need to... | Do this |');
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
	});
});
