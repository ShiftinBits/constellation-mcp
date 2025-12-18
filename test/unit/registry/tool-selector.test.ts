/**
 * Tool Selector Unit Tests
 *
 * Tests utility functions for AI agents to discover and select tools.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
	suggestToolsForIntent,
	getToolExamples,
	validateToolParameters,
	getRelatedTools,
	findToolForUseCase,
	getToolUsageTips,
	getToolSummary,
	compareTools,
} from '../../../src/registry/tool-selector.js';
import { getToolRegistry, resetToolRegistry } from '../../../src/registry/ToolRegistry.js';
import {
	createMockToolDefinition,
	createToolDefinitionSet,
} from '../../helpers/mock-factories.js';

describe('tool-selector', () => {
	beforeEach(() => {
		resetToolRegistry();
		// Register test tools
		const registry = getToolRegistry();
		registry.registerMany(createToolDefinitionSet());
	});

	afterEach(() => {
		resetToolRegistry();
	});

	describe('suggestToolsForIntent', () => {
		it('should delegate to registry.findToolsByIntent', () => {
			const tools = suggestToolsForIntent(['discovery']);
			expect(tools.some(t => t.name === 'discovery_tool')).toBe(true);
		});

		it('should return matching tools for keywords', () => {
			const tools = suggestToolsForIntent(['dependency', 'analysis']);
			expect(tools.length).toBeGreaterThan(0);
		});

		it('should return empty array for no matches', () => {
			const tools = suggestToolsForIntent(['xyznonexistent']);
			expect(tools).toEqual([]);
		});

		it('should handle multiple keywords', () => {
			const tools = suggestToolsForIntent(['impact', 'change', 'breaking']);
			// impact_tool should match well
			expect(tools.some(t => t.name === 'impact_tool')).toBe(true);
		});
	});

	describe('getToolExamples', () => {
		it('should delegate to registry.getToolExamples', () => {
			const examples = getToolExamples('discovery_tool');
			expect(examples).toHaveLength(2);
		});

		it('should return examples for tool', () => {
			const examples = getToolExamples('discovery_tool');
			expect(examples[0]).toHaveProperty('title');
			expect(examples[0]).toHaveProperty('parameters');
		});

		it('should return empty array for non-existent tool', () => {
			const examples = getToolExamples('non_existent_tool');
			expect(examples).toEqual([]);
		});
	});

	describe('validateToolParameters', () => {
		beforeEach(() => {
			// Register a tool with specific schema for validation testing
			const registry = getToolRegistry();
			registry.register(createMockToolDefinition({
				name: 'validation_test_tool',
				inputSchema: {
					type: 'object',
					properties: {
						requiredField: { type: 'string' },
						optionalField: { type: 'number' },
					},
					required: ['requiredField'],
				},
				relatedTools: ['discovery_tool'],
			}));
		});

		it('should return valid=true for correct parameters', () => {
			const result = validateToolParameters('validation_test_tool', {
				requiredField: 'value',
			});
			expect(result.valid).toBe(true);
			expect(result.errors).toBeUndefined();
		});

		it('should return error for tool not found', () => {
			const result = validateToolParameters('non_existent_tool', {});
			expect(result.valid).toBe(false);
			expect(result.errors).toContain("Tool 'non_existent_tool' not found in registry");
		});

		it('should return error for missing required parameters', () => {
			const result = validateToolParameters('validation_test_tool', {
				optionalField: 42,
			});
			expect(result.valid).toBe(false);
			expect(result.errors?.some(e => e.includes('Missing required parameter'))).toBe(true);
		});

		it('should return error for unknown parameters', () => {
			const result = validateToolParameters('validation_test_tool', {
				requiredField: 'value',
				unknownField: 'bad',
			});
			expect(result.valid).toBe(false);
			expect(result.errors?.some(e => e.includes('Unknown parameter'))).toBe(true);
		});

		it('should list valid parameters in error message', () => {
			const result = validateToolParameters('validation_test_tool', {
				requiredField: 'value',
				badParam: 'test',
			});
			expect(result.errors?.some(e => e.includes('requiredField'))).toBe(true);
			expect(result.errors?.some(e => e.includes('optionalField'))).toBe(true);
		});

		it('should accept all valid optional parameters', () => {
			const result = validateToolParameters('validation_test_tool', {
				requiredField: 'value',
				optionalField: 100,
			});
			expect(result.valid).toBe(true);
		});
	});

	describe('getRelatedTools', () => {
		it('should delegate to registry.getRelatedTools', () => {
			const related = getRelatedTools('impact_tool');
			expect(related.length).toBeGreaterThan(0);
		});

		it('should return related tool definitions', () => {
			const related = getRelatedTools('impact_tool');
			// impact_tool has relatedTools: ['dependency_tool', 'discovery_tool']
			expect(related.some(t => t.name === 'dependency_tool')).toBe(true);
			expect(related.some(t => t.name === 'discovery_tool')).toBe(true);
		});

		it('should return empty array for non-existent tool', () => {
			const related = getRelatedTools('non_existent_tool');
			expect(related).toEqual([]);
		});
	});

	describe('findToolForUseCase', () => {
		it('should find best tool for use case description', () => {
			const tool = findToolForUseCase('I want to find symbols in the codebase');
			// 'symbols' should match discovery_tool
			expect(tool).toBeDefined();
			expect(tool?.name).toBe('discovery_tool');
		});

		it('should filter out short words (<=3 chars)', () => {
			// 'the', 'to', 'I' should be filtered
			const tool = findToolForUseCase('find the dependency');
			// 'dependency' should match dependency_tool
			expect(tool).toBeDefined();
		});

		it('should return undefined when no match', () => {
			const tool = findToolForUseCase('xyz abc def ghi');
			expect(tool).toBeUndefined();
		});

		it('should return first tool from suggestions', () => {
			const tool = findToolForUseCase('analyze dependency impact');
			expect(tool).toBeDefined();
			// Should return highest scoring match
		});

		it('should handle empty use case', () => {
			const tool = findToolForUseCase('');
			expect(tool).toBeUndefined();
		});

		it('should handle use case with only short words', () => {
			const tool = findToolForUseCase('a to the in on');
			expect(tool).toBeUndefined();
		});
	});

	describe('getToolUsageTips', () => {
		it('should return commonMistakes for tool', () => {
			// Our mock tools have commonMistakes
			const tips = getToolUsageTips('discovery_tool');
			expect(tips.commonMistakes).toBeDefined();
			expect(tips.commonMistakes?.length).toBeGreaterThan(0);
		});

		it('should return relatedTools list', () => {
			const tips = getToolUsageTips('impact_tool');
			expect(tips.relatedTools).toBeDefined();
			expect(tips.relatedTools.length).toBeGreaterThan(0);
		});

		it('should return empty relatedTools for non-existent tool', () => {
			const tips = getToolUsageTips('non_existent_tool');
			expect(tips.relatedTools).toEqual([]);
		});

		it('should return undefined commonMistakes when tool has none', () => {
			// Register a tool without commonMistakes
			const registry = getToolRegistry();
			const minimalTool = createMockToolDefinition({
				name: 'minimal_tips_tool',
				relatedTools: ['discovery_tool'],
			});
			delete (minimalTool as any).commonMistakes;
			registry.register(minimalTool);

			const tips = getToolUsageTips('minimal_tips_tool');
			expect(tips.commonMistakes).toBeUndefined();
		});
	});

	describe('getToolSummary', () => {
		it('should format tool summary with name and category', () => {
			const summary = getToolSummary('discovery_tool');
			expect(summary).toContain('discovery_tool');
			expect(summary).toContain('Discovery');
		});

		it('should include description', () => {
			const summary = getToolSummary('discovery_tool');
			expect(summary).toContain('finding symbols');
		});

		it('should list whenToUse items', () => {
			const summary = getToolSummary('discovery_tool');
			expect(summary).toContain('When to use:');
		});

		it('should include related tools', () => {
			const summary = getToolSummary('impact_tool');
			expect(summary).toContain('Related tools:');
			expect(summary).toContain('dependency_tool');
		});

		it('should show examples count', () => {
			const summary = getToolSummary('discovery_tool');
			expect(summary).toContain('Examples: 2 available');
		});

		it('should return "not found" message for non-existent tool', () => {
			const summary = getToolSummary('non_existent_tool');
			expect(summary).toContain("Tool 'non_existent_tool' not found");
		});
	});

	describe('compareTools', () => {
		it('should return null if first tool not found', () => {
			const result = compareTools('non_existent', 'discovery_tool');
			expect(result).toBeNull();
		});

		it('should return null if second tool not found', () => {
			const result = compareTools('discovery_tool', 'non_existent');
			expect(result).toBeNull();
		});

		it('should compare two tools', () => {
			const result = compareTools('discovery_tool', 'impact_tool');

			expect(result).not.toBeNull();
			expect(result?.tool1.name).toBe('discovery_tool');
			expect(result?.tool2.name).toBe('impact_tool');
		});

		it('should identify category differences', () => {
			const result = compareTools('discovery_tool', 'impact_tool');

			expect(result?.differences.some(d =>
				d.includes('Discovery') && d.includes('Impact')
			)).toBe(true);
		});

		it('should identify required parameter count differences', () => {
			// Register tools with different required params
			const registry = getToolRegistry();
			registry.register(createMockToolDefinition({
				name: 'one_required_tool',
				inputSchema: {
					type: 'object',
					properties: { a: { type: 'string' } },
					required: ['a'],
				},
				relatedTools: ['discovery_tool'],
			}));
			registry.register(createMockToolDefinition({
				name: 'three_required_tool',
				inputSchema: {
					type: 'object',
					properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
					required: ['a', 'b', 'c'],
				},
				relatedTools: ['discovery_tool'],
			}));

			const result = compareTools('one_required_tool', 'three_required_tool');

			expect(result?.differences.some(d =>
				d.includes('requires 1') && d.includes('requires 3')
			)).toBe(true);
		});

		it('should identify example count differences', () => {
			// Register tools with different example counts
			const registry = getToolRegistry();
			registry.register(createMockToolDefinition({
				name: 'few_examples_tool',
				examples: [
					{ title: 'Example One', description: 'Example one test', parameters: {} },
					{ title: 'Example Two', description: 'Example two test', parameters: {} },
				],
				relatedTools: ['discovery_tool'],
			}));
			registry.register(createMockToolDefinition({
				name: 'many_examples_tool',
				examples: [
					{ title: 'Example One', description: 'Example one test', parameters: {} },
					{ title: 'Example Two', description: 'Example two test', parameters: {} },
					{ title: 'Example Three', description: 'Example three test', parameters: {} },
					{ title: 'Example Four', description: 'Example four test', parameters: {} },
				],
				relatedTools: ['discovery_tool'],
			}));

			const result = compareTools('few_examples_tool', 'many_examples_tool');

			// Verify example count difference is detected
			expect(result?.differences.some(d =>
				d.includes('few_examples_tool') &&
				d.includes('many_examples_tool') &&
				d.includes('examples')
			)).toBe(true);
		});

		it('should return empty differences for identical tools', () => {
			// Compare tool with itself
			const result = compareTools('discovery_tool', 'discovery_tool');

			expect(result).not.toBeNull();
			expect(result?.differences).toEqual([]);
		});

		it('should return tool descriptions in comparison', () => {
			const result = compareTools('discovery_tool', 'impact_tool');

			expect(result?.tool1.description).toBeDefined();
			expect(result?.tool2.description).toBeDefined();
		});
	});
});
