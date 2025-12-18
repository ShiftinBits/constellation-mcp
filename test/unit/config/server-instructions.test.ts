/**
 * Server Instructions Unit Tests
 *
 * Tests the getServerInstructions function that provides
 * comprehensive guidance to AI assistants about Constellation tools.
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

		it('should include the main header', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('# Constellation MCP Server');
			expect(instructions).toContain('Code Intelligence Tools');
		});

		it('should include core principle section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Core Principle');
			expect(instructions).toContain('Constellation = Code Metadata & Relationships');
		});

		it('should include when to use section with proactive triggers', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## When to Use Constellation (Proactive)');
			expect(instructions).toContain('**Discovery**');
			expect(instructions).toContain('**Dependencies**');
			expect(instructions).toContain('**Impact Analysis**');
			expect(instructions).toContain('**Architecture**');
			expect(instructions).toContain('**Code Quality**');
		});

		it('should include when NOT to use section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## When NOT to Use');
			expect(instructions).toContain('Reading source code');
			expect(instructions).toContain('Modifying files');
			expect(instructions).toContain('Running commands');
		});

		it('should include tool categories section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Tool Categories');
			expect(instructions).toContain('**Discovery');
			expect(instructions).toContain('**Dependency');
			expect(instructions).toContain('**Impact');
			expect(instructions).toContain('**Architecture');
		});

		it('should list key tool names', () => {
			const instructions = getServerInstructions();
			// Discovery tools
			expect(instructions).toContain('search_symbols');
			expect(instructions).toContain('get_symbol_details');
			// Dependency tools
			expect(instructions).toContain('get_dependencies');
			expect(instructions).toContain('get_dependents');
			expect(instructions).toContain('trace_symbol_usage');
			expect(instructions).toContain('get_call_graph');
			expect(instructions).toContain('find_circular_dependencies');
			// Impact tools
			expect(instructions).toContain('impact_analysis');
			expect(instructions).toContain('find_orphaned_code');
			// Architecture tools
			expect(instructions).toContain('get_architecture_overview');
		});

		it('should include common tool chaining patterns', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Common Tool Chaining Patterns');
			expect(instructions).toContain('### Pattern 1: Before Refactoring');
			expect(instructions).toContain('### Pattern 2: Understanding New Codebase');
			expect(instructions).toContain('### Pattern 3: Debugging Dependencies');
			expect(instructions).toContain('### Pattern 4: Finding Dead Code');
		});

		it('should include best practices section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Best Practices');
			expect(instructions).toContain('### Start Small, Escalate');
			expect(instructions).toContain('### Use symbolId');
			expect(instructions).toContain('### Chain Tools Effectively');
			expect(instructions).toContain('### Leverage Cache');
			expect(instructions).toContain('### Filter Appropriately');
		});

		it('should include quick decision matrix', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Quick Decision Matrix');
			expect(instructions).toContain('**Need to...**');
		});

		it('should include tool-specific guidance section', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('## Tool-Specific Guidance');
			expect(instructions).toContain('whenToUse');
			expect(instructions).toContain('examples');
			expect(instructions).toContain('commonMistakes');
			expect(instructions).toContain('relatedTools');
		});

		it('should include start here section for new users', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('**Start Here for New Users:**');
			expect(instructions).toContain('1. `get_architecture_overview`');
			expect(instructions).toContain('2. `search_symbols`');
			expect(instructions).toContain('3. `impact_analysis`');
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

		it('should mention caching behavior', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('cached');
			expect(instructions).toContain('<100ms');
		});

		it('should mention excludeTests filter option', () => {
			const instructions = getServerInstructions();
			expect(instructions).toContain('excludeTests=true');
			expect(instructions).toContain('excludeTests=false');
		});
	});
});
