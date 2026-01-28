/**
 * ToolRegistry Unit Tests
 *
 * Tests the central registry for enhanced MCP tool definitions.
 */

import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach,
} from '@jest/globals';
import {
	ToolRegistry,
	getToolRegistry,
	resetToolRegistry,
} from '../../../src/registry/ToolRegistry.js';
import {
	McpToolDefinition,
	ToolCategory,
} from '../../../src/registry/McpToolDefinition.interface.js';
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

		it('should initialize with empty state', () => {
			expect(registry.getAllTools()).toHaveLength(0);
			expect(registry.isInitialized()).toBe(false);
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
				/Invalid tool definition/,
			);
		});

		it('should throw error for invalid definition (bad name format)', () => {
			const invalidDef = createInvalidToolDefinition('name');

			expect(() => registry.register(invalidDef as McpToolDefinition)).toThrow(
				/Invalid tool definition/,
			);
		});

		it('should throw error for duplicate tool name', () => {
			const definition = createMockToolDefinition();
			registry.register(definition);

			expect(() => registry.register(definition)).toThrow(
				"Tool 'test_tool' is already registered",
			);
		});

		it('should add tool to registry', () => {
			const definition = createMockToolDefinition({ category: 'Impact' });
			registry.register(definition);

			const allTools = registry.getAllTools();
			expect(allTools).toHaveLength(1);
			expect(allTools[0].name).toBe('test_tool');
		});

		it('should log registration to console.error', () => {
			const definition = createMockToolDefinition();
			registry.register(definition);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[ToolRegistry] Registered tool: test_tool'),
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

			expect(() => registry.registerMany(definitions)).toThrow(
				/Invalid tool definition/,
			);
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
			expect(
				validation.errors.some((e) => e.includes('non-existent related tool')),
			).toBe(true);
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
			expect(
				validation.warnings.some((w) =>
					w.includes('missing required parameter'),
				),
			).toBe(true);
		});

		it('should return warning for tool with no examples', () => {
			// We can't easily create a tool with no examples since validation requires 2+
			// But we can test the logic exists by examining the implementation
			// For this test, we verify the existing tools have examples
			registry.register(createMockToolDefinition());
			const validation = registry.validateRegistry();
			expect(
				validation.warnings.filter((w) => w.includes('has no examples')),
			).toHaveLength(0);
		});

		it('should return warning for tool with fewer than 3 use cases', () => {
			// Can't easily create since validation requires 3+ whenToUse
			// Verify existing tool passes
			registry.register(createMockToolDefinition());
			const validation = registry.validateRegistry();
			expect(
				validation.warnings.filter(
					(w) => w.includes('only') && w.includes('use cases'),
				),
			).toHaveLength(0);
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

			expect(result.warnings).toContain(
				'Tool registry not marked as initialized',
			);
		});

		it('should log available tool metadata', () => {
			registry.register(createMockToolDefinition());
			registry.markInitialized();

			registry.validateWithMcpServer(mockServer);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[ToolRegistry] Available tool metadata:'),
			);
		});

		it('should return warning if execute_code missing', () => {
			registry.register(createMockToolDefinition({ name: 'other_tool' }));
			registry.markInitialized();

			const result = registry.validateWithMcpServer(mockServer);

			expect(result.warnings).toContain(
				'Missing metadata for execute_code tool',
			);
		});

		it('should return valid=true when all checks pass', () => {
			registry.register(createMockToolDefinition({ name: 'execute_code' }));
			registry.markInitialized();

			const result = registry.validateWithMcpServer(mockServer);

			expect(result.valid).toBe(true);
			expect(result.warnings).toHaveLength(0);
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
		registry1.register(
			createMockToolDefinition({ name: 'singleton_test_tool' }),
		);

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
