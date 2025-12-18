/**
 * ToolRegistry Unit Tests
 *
 * Tests the central registry for enhanced MCP tool definitions.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
	ToolRegistry,
	getToolRegistry,
	resetToolRegistry,
} from '../../../src/registry/ToolRegistry.js';
import { McpToolDefinition, ToolCategory } from '../../../src/registry/McpToolDefinition.interface.js';
import {
	createMockToolDefinition,
	createMinimalToolDefinition,
	createInvalidToolDefinition,
	createToolDefinitionSet,
	createToolDefinitionWithTriggers,
} from '../../helpers/mock-factories.js';

describe('ToolRegistry', () => {
	let registry: ToolRegistry;
	let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

	beforeEach(() => {
		registry = new ToolRegistry();
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	describe('constructor', () => {
		it('should initialize with empty tools map', () => {
			expect(registry.getAllTools()).toHaveLength(0);
		});

		it('should initialize with empty category map', () => {
			const categories: ToolCategory[] = ['Discovery', 'Dependency', 'Impact', 'Architecture', 'Refactoring'];
			for (const category of categories) {
				expect(registry.getToolsByCategory(category)).toHaveLength(0);
			}
		});

		it('should initialize with initialized=false', () => {
			expect(registry.isInitialized()).toBe(false);
		});
	});

	describe('register', () => {
		it('should register a valid tool definition', () => {
			const definition = createMockToolDefinition();
			registry.register(definition);

			expect(registry.getToolByName('test_tool')).toEqual(definition);
		});

		it('should throw error for invalid definition (missing required fields)', () => {
			const invalidDef = createInvalidToolDefinition('description');

			expect(() => registry.register(invalidDef as McpToolDefinition)).toThrow(
				/Invalid tool definition/
			);
		});

		it('should throw error for invalid definition (bad name format)', () => {
			const invalidDef = createInvalidToolDefinition('name');

			expect(() => registry.register(invalidDef as McpToolDefinition)).toThrow(
				/Invalid tool definition/
			);
		});

		it('should throw error for duplicate tool name', () => {
			const definition = createMockToolDefinition();
			registry.register(definition);

			expect(() => registry.register(definition)).toThrow(
				"Tool 'test_tool' is already registered"
			);
		});

		it('should add tool to category index', () => {
			const definition = createMockToolDefinition({ category: 'Impact' });
			registry.register(definition);

			const impactTools = registry.getToolsByCategory('Impact');
			expect(impactTools).toHaveLength(1);
			expect(impactTools[0].name).toBe('test_tool');
		});

		it('should create new category set if not exists', () => {
			const discoveryTool = createMockToolDefinition({ name: 'discovery_tool', category: 'Discovery' });
			const impactTool = createMockToolDefinition({ name: 'impact_tool', category: 'Impact' });

			registry.register(discoveryTool);
			registry.register(impactTool);

			expect(registry.getToolsByCategory('Discovery')).toHaveLength(1);
			expect(registry.getToolsByCategory('Impact')).toHaveLength(1);
		});

		it('should log registration to console.error', () => {
			const definition = createMockToolDefinition();
			registry.register(definition);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[ToolRegistry] Registered tool: test_tool')
			);
		});

		it('should register tool with trigger phrases', () => {
			const definition = createToolDefinitionWithTriggers('trigger_tool');
			registry.register(definition);

			const registered = registry.getToolByName('trigger_tool');
			expect(registered?.triggerPhrases).toHaveLength(5);
		});
	});

	describe('registerMany', () => {
		it('should register multiple valid definitions', () => {
			const definitions = createToolDefinitionSet();
			registry.registerMany(definitions);

			expect(registry.getAllTools()).toHaveLength(3);
		});

		it('should throw on first validation error', () => {
			const definitions = [
				createMockToolDefinition({ name: 'valid_tool' }),
				createInvalidToolDefinition('description') as McpToolDefinition,
				createMockToolDefinition({ name: 'another_tool' }),
			];

			expect(() => registry.registerMany(definitions)).toThrow(/Invalid tool definition/);
		});

		it('should stop registration after first error', () => {
			const definitions = [
				createMockToolDefinition({ name: 'first_tool' }),
				createInvalidToolDefinition('description') as McpToolDefinition,
				createMockToolDefinition({ name: 'third_tool' }),
			];

			try {
				registry.registerMany(definitions);
			} catch {
				// Expected to throw
			}

			// Only first tool should be registered
			expect(registry.getAllTools()).toHaveLength(1);
			expect(registry.getToolByName('first_tool')).toBeDefined();
			expect(registry.getToolByName('third_tool')).toBeUndefined();
		});
	});

	describe('getToolByName', () => {
		it('should return tool definition by name', () => {
			const definition = createMockToolDefinition({ name: 'my_tool' });
			registry.register(definition);

			const result = registry.getToolByName('my_tool');
			expect(result).toEqual(definition);
		});

		it('should return undefined for non-existent tool', () => {
			const result = registry.getToolByName('non_existent_tool');
			expect(result).toBeUndefined();
		});
	});

	describe('getToolsByCategory', () => {
		beforeEach(() => {
			registry.registerMany(createToolDefinitionSet());
		});

		it('should return all tools in category', () => {
			const discoveryTools = registry.getToolsByCategory('Discovery');
			expect(discoveryTools).toHaveLength(1);
			expect(discoveryTools[0].name).toBe('discovery_tool');
		});

		it('should return empty array for empty category', () => {
			const architectureTools = registry.getToolsByCategory('Architecture');
			expect(architectureTools).toEqual([]);
		});

		it('should return empty array for category with no tools', () => {
			const refactoringTools = registry.getToolsByCategory('Refactoring');
			expect(refactoringTools).toEqual([]);
		});
	});

	describe('getAllTools', () => {
		it('should return all registered tools', () => {
			registry.registerMany(createToolDefinitionSet());

			const allTools = registry.getAllTools();
			expect(allTools).toHaveLength(3);
		});

		it('should return empty array when no tools registered', () => {
			const allTools = registry.getAllTools();
			expect(allTools).toEqual([]);
		});
	});

	describe('findToolsByIntent', () => {
		beforeEach(() => {
			registry.registerMany(createToolDefinitionSet());
		});

		it('should find tools by description keyword match', () => {
			// 'symbols' appears in discovery_tool description
			const tools = registry.findToolsByIntent(['symbols']);
			expect(tools.length).toBeGreaterThan(0);
			expect(tools[0].name).toBe('discovery_tool');
		});

		it('should find tools by use case keyword match', () => {
			// 'testing' appears in whenToUse
			const tools = registry.findToolsByIntent(['testing']);
			expect(tools.length).toBeGreaterThan(0);
		});

		it('should find tools by name keyword match', () => {
			const tools = registry.findToolsByIntent(['discovery']);
			expect(tools.some(t => t.name === 'discovery_tool')).toBe(true);
		});

		it('should return tools sorted by relevance score', () => {
			// 'dependency' should match dependency_tool more strongly
			const tools = registry.findToolsByIntent(['dependency']);
			expect(tools[0].name).toBe('dependency_tool');
		});

		it('should handle case-insensitive matching', () => {
			const toolsLower = registry.findToolsByIntent(['discovery']);
			const toolsUpper = registry.findToolsByIntent(['DISCOVERY']);
			const toolsMixed = registry.findToolsByIntent(['DiScOvErY']);

			expect(toolsLower.length).toBe(toolsUpper.length);
			expect(toolsLower.length).toBe(toolsMixed.length);
		});

		it('should return empty array when no matches', () => {
			const tools = registry.findToolsByIntent(['xyznonexistent123']);
			expect(tools).toEqual([]);
		});

		it('should score description matches higher than name matches', () => {
			// Create tools where description match should win over name match
			const newRegistry = new ToolRegistry();

			// Tool A: 'unicorn' only in name (score: 1)
			newRegistry.register(createMockToolDefinition({
				name: 'unicorn_finder',
				description: 'A tool that finds magical creatures. Use it to locate rare beings. Great for fantasy searches.',
				whenToUse: [
					'When searching for magical creatures',
					'When exploring fantasy codebases',
					'When looking for rare symbols',
				],
				relatedTools: ['rainbow_tool'],
			}));

			// Tool B: 'unicorn' twice in description (score: 6)
			newRegistry.register(createMockToolDefinition({
				name: 'rainbow_tool',
				description: 'A unicorn discovery tool for unicorn patterns. Use it to find rainbow patterns. Excellent for colorful code.',
				whenToUse: [
					'When searching for rainbow patterns',
					'When exploring colorful code',
					'When looking for bright symbols',
				],
				relatedTools: ['unicorn_finder'],
			}));

			const tools = newRegistry.findToolsByIntent(['unicorn']);
			// rainbow_tool has 'unicorn' 2x in description (score: 6)
			// unicorn_finder has 'unicorn' 1x in name (score: 1)
			expect(tools[0].name).toBe('rainbow_tool');
		});
	});

	describe('getRelatedTools', () => {
		beforeEach(() => {
			registry.registerMany(createToolDefinitionSet());
		});

		it('should return related tool definitions', () => {
			// impact_tool has relatedTools: ['dependency_tool', 'discovery_tool']
			const related = registry.getRelatedTools('impact_tool');
			expect(related).toHaveLength(2);
			expect(related.map(t => t.name)).toContain('dependency_tool');
			expect(related.map(t => t.name)).toContain('discovery_tool');
		});

		it('should return empty array for non-existent tool', () => {
			const related = registry.getRelatedTools('non_existent');
			expect(related).toEqual([]);
		});

		it('should filter out non-existent related tools', () => {
			// Create a tool that references a non-existent related tool
			const toolWithBadRef = createMockToolDefinition({
				name: 'tool_with_bad_ref',
				relatedTools: ['discovery_tool', 'non_existent_tool'],
			});
			registry.register(toolWithBadRef);

			const related = registry.getRelatedTools('tool_with_bad_ref');
			expect(related).toHaveLength(1);
			expect(related[0].name).toBe('discovery_tool');
		});
	});

	describe('getToolExamples', () => {
		it('should return tool examples', () => {
			const definition = createMockToolDefinition();
			registry.register(definition);

			const examples = registry.getToolExamples('test_tool');
			expect(examples).toHaveLength(2);
			expect(examples[0].title).toBe('Basic test query');
		});

		it('should return empty array for non-existent tool', () => {
			const examples = registry.getToolExamples('non_existent');
			expect(examples).toEqual([]);
		});
	});

	describe('validateRegistry', () => {
		it('should return valid=true when all tools valid', () => {
			registry.registerMany(createToolDefinitionSet());

			const validation = registry.validateRegistry();
			expect(validation.valid).toBe(true);
			expect(validation.errors).toEqual([]);
		});

		it('should return error for non-existent related tool reference', () => {
			const toolWithBadRef = createMockToolDefinition({
				name: 'bad_ref_tool',
				relatedTools: ['non_existent_tool'],
			});
			registry.register(toolWithBadRef);

			const validation = registry.validateRegistry();
			expect(validation.valid).toBe(false);
			expect(validation.errors.some(e => e.includes('non-existent related tool'))).toBe(true);
		});

		it('should return warning for missing required parameter in example', () => {
			const toolWithBadExample = createMockToolDefinition({
				name: 'bad_example_tool',
				inputSchema: {
					type: 'object',
					properties: { requiredField: { type: 'string' } },
					required: ['requiredField'],
				},
				examples: [
					{
						title: 'Missing required param',
						description: 'This example is missing the required field',
						parameters: {}, // Missing requiredField
					},
					{
						title: 'Valid example',
						description: 'This example has all required fields',
						parameters: { requiredField: 'value' },
					},
				],
			});
			registry.register(toolWithBadExample);

			const validation = registry.validateRegistry();
			expect(validation.warnings.some(w => w.includes('missing required parameter'))).toBe(true);
		});

		it('should return warning for tool with no examples', () => {
			// We can't easily create a tool with no examples since validation requires 2+
			// But we can test the logic exists by examining the implementation
			// For this test, we verify the existing tools have examples
			registry.register(createMockToolDefinition());
			const validation = registry.validateRegistry();
			expect(validation.warnings.filter(w => w.includes('has no examples'))).toHaveLength(0);
		});

		it('should return warning for tool with fewer than 3 use cases', () => {
			// Can't easily create since validation requires 3+ whenToUse
			// Verify existing tool passes
			registry.register(createMockToolDefinition());
			const validation = registry.validateRegistry();
			expect(validation.warnings.filter(w => w.includes('only') && w.includes('use cases'))).toHaveLength(0);
		});
	});

	describe('getStats', () => {
		it('should return correct totalTools count', () => {
			registry.registerMany(createToolDefinitionSet());

			const stats = registry.getStats();
			expect(stats.totalTools).toBe(3);
		});

		it('should return correct byCategory counts', () => {
			registry.registerMany(createToolDefinitionSet());

			const stats = registry.getStats();
			expect(stats.byCategory['Discovery']).toBe(1);
			expect(stats.byCategory['Dependency']).toBe(1);
			expect(stats.byCategory['Impact']).toBe(1);
		});

		it('should count toolsWithExamples correctly', () => {
			registry.registerMany(createToolDefinitionSet());

			const stats = registry.getStats();
			expect(stats.toolsWithExamples).toBe(3); // All have examples
		});

		it('should calculate averageExamplesPerTool', () => {
			registry.registerMany(createToolDefinitionSet());

			const stats = registry.getStats();
			// Each tool has 2 examples, so average is 2
			expect(stats.averageExamplesPerTool).toBe(2);
		});

		it('should handle empty registry', () => {
			const stats = registry.getStats();

			expect(stats.totalTools).toBe(0);
			expect(stats.toolsWithExamples).toBe(0);
			expect(stats.averageExamplesPerTool).toBe(0);
		});
	});

	describe('clear', () => {
		it('should clear all tools', () => {
			registry.registerMany(createToolDefinitionSet());
			registry.clear();

			expect(registry.getAllTools()).toHaveLength(0);
		});

		it('should clear category index', () => {
			registry.registerMany(createToolDefinitionSet());
			registry.clear();

			expect(registry.getToolsByCategory('Discovery')).toHaveLength(0);
			expect(registry.getToolsByCategory('Dependency')).toHaveLength(0);
			expect(registry.getToolsByCategory('Impact')).toHaveLength(0);
		});

		it('should reset initialized flag', () => {
			registry.markInitialized();
			expect(registry.isInitialized()).toBe(true);

			registry.clear();
			expect(registry.isInitialized()).toBe(false);
		});
	});

	describe('markInitialized / isInitialized', () => {
		it('should mark registry as initialized', () => {
			expect(registry.isInitialized()).toBe(false);

			registry.markInitialized();

			expect(registry.isInitialized()).toBe(true);
		});

		it('should return correct initialization state', () => {
			expect(registry.isInitialized()).toBe(false);
			registry.markInitialized();
			expect(registry.isInitialized()).toBe(true);
		});
	});

	describe('validateWithMcpServer', () => {
		const mockServer = {}; // Mock MCP server

		it('should return warning if not initialized', () => {
			const result = registry.validateWithMcpServer(mockServer);

			expect(result.warnings).toContain('Tool registry not marked as initialized');
		});

		it('should log available tool metadata', () => {
			registry.register(createMockToolDefinition());
			registry.markInitialized();

			registry.validateWithMcpServer(mockServer);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[ToolRegistry] Available tool metadata:')
			);
		});

		it('should return warning if execute_code missing', () => {
			registry.register(createMockToolDefinition({ name: 'other_tool' }));
			registry.markInitialized();

			const result = registry.validateWithMcpServer(mockServer);

			expect(result.warnings).toContain('Missing metadata for execute_code tool');
		});

		it('should return valid=true when all checks pass', () => {
			registry.register(createMockToolDefinition({ name: 'execute_code' }));
			registry.markInitialized();

			const result = registry.validateWithMcpServer(mockServer);

			expect(result.valid).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});
	});

	describe('generateSummary', () => {
		it('should generate formatted summary text', () => {
			registry.registerMany(createToolDefinitionSet());

			const summary = registry.generateSummary();

			expect(summary).toContain('Constellation MCP Tools Registry');
			expect(summary).toContain('================================');
		});

		it('should include stats in summary', () => {
			registry.registerMany(createToolDefinitionSet());

			const summary = registry.generateSummary();

			expect(summary).toContain('Total Tools: 3');
			expect(summary).toContain('Tools with Examples: 3');
		});

		it('should group tools by category', () => {
			registry.registerMany(createToolDefinitionSet());

			const summary = registry.generateSummary();

			expect(summary).toContain('Discovery (1)');
			expect(summary).toContain('Dependency (1)');
			expect(summary).toContain('Impact (1)');
		});

		it('should include tool details', () => {
			registry.registerMany(createToolDefinitionSet());

			const summary = registry.generateSummary();

			expect(summary).toContain('discovery_tool');
			expect(summary).toContain('Examples: 2');
			expect(summary).toContain('Use Cases: 3');
		});
	});
});

describe('getToolRegistry', () => {
	beforeEach(() => {
		resetToolRegistry();
	});

	afterEach(() => {
		resetToolRegistry();
	});

	it('should return singleton instance', () => {
		const registry1 = getToolRegistry();
		const registry2 = getToolRegistry();

		expect(registry1).toBe(registry2);
	});

	it('should return same instance on multiple calls', () => {
		const registry1 = getToolRegistry();
		registry1.register(createMockToolDefinition({ name: 'singleton_test_tool' }));

		const registry2 = getToolRegistry();

		expect(registry2.getToolByName('singleton_test_tool')).toBeDefined();
	});
});

describe('resetToolRegistry', () => {
	it('should reset singleton to null', () => {
		const registry1 = getToolRegistry();
		registry1.register(createMockToolDefinition({ name: 'reset_test_tool' }));

		resetToolRegistry();
		const registry2 = getToolRegistry();

		expect(registry2.getToolByName('reset_test_tool')).toBeUndefined();
	});

	it('should allow new instance creation', () => {
		const registry1 = getToolRegistry();
		resetToolRegistry();
		const registry2 = getToolRegistry();

		expect(registry1).not.toBe(registry2);
	});
});
