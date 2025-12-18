/**
 * Mock Factory Functions for Unit Tests
 *
 * Provides reusable mock creators for tool definitions, config contexts,
 * and other common test data structures.
 */

import { McpToolDefinition, ToolCategory, ToolExample } from '../../src/registry/McpToolDefinition.interface.js';

/**
 * Create a valid mock tool definition
 *
 * Returns a definition that passes all validation rules.
 * Override any field by passing a partial object.
 */
export function createMockToolDefinition(
	overrides: Partial<McpToolDefinition> = {}
): McpToolDefinition {
	const defaults: McpToolDefinition = {
		name: 'test_tool',
		category: 'Discovery',
		description:
			'A test tool for unit testing purposes. This tool validates that the registry correctly handles tool definitions. Use it when testing registry functionality.',
		shortDescription: 'Test tool for unit tests',
		whenToUse: [
			'When unit testing the ToolRegistry class',
			'When validating tool definition schemas',
			'When testing tool discovery functionality',
		],
		relatedTools: ['other_test_tool'],
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query for testing',
				},
				limit: {
					type: 'number',
					description: 'Maximum results to return',
				},
			},
			required: ['query'],
		},
		examples: [
			{
				title: 'Basic test query',
				description: 'A simple test query to validate functionality',
				parameters: { query: 'test' },
				expectedOutcome: 'Returns test results',
			},
			{
				title: 'Test with limit',
				description: 'Test query with result limiting',
				parameters: { query: 'test', limit: 10 },
				expectedOutcome: 'Returns up to 10 results',
			},
		],
		commonMistakes: [
			'Do not use empty query string',
			'Limit must be positive number',
		],
		sinceVersion: '1.0.0',
	};

	return { ...defaults, ...overrides };
}

/**
 * Create a minimal valid tool definition
 *
 * Contains only required fields at minimum valid values.
 */
export function createMinimalToolDefinition(
	name: string = 'minimal_tool'
): McpToolDefinition {
	return {
		name,
		category: 'Discovery',
		description:
			'A minimal tool definition for testing. It contains only the required fields at minimum values. Use for testing validation boundaries.',
		whenToUse: [
			'Testing minimum requirements',
			'Validating schema boundaries',
			'Unit test edge cases',
		],
		relatedTools: ['test_tool'],
		inputSchema: {
			type: 'object',
			properties: {},
		},
		examples: [
			{
				title: 'Empty example',
				description: 'An example with no parameters',
				parameters: {},
			},
			{
				title: 'Second example',
				description: 'Another example with no parameters',
				parameters: {},
			},
		],
	};
}

/**
 * Create an invalid tool definition for testing validation errors
 *
 * @param invalidField - Which field to make invalid
 */
export function createInvalidToolDefinition(
	invalidField: 'name' | 'description' | 'whenToUse' | 'examples' | 'category'
): Partial<McpToolDefinition> {
	const base = createMockToolDefinition();

	switch (invalidField) {
		case 'name':
			// Name must be snake_case, start with letter, 3+ chars
			return { ...base, name: 'AB' }; // Too short
		case 'description':
			// Description must be 50+ chars with 2+ sentences
			return { ...base, description: 'Too short' };
		case 'whenToUse':
			// Must have 3-7 items
			return { ...base, whenToUse: ['Only one item'] };
		case 'examples':
			// Must have 2-5 examples
			return { ...base, examples: [] };
		case 'category':
			// Must be valid enum value
			return { ...base, category: 'InvalidCategory' as ToolCategory };
		default:
			return base;
	}
}

/**
 * Create a tool definition with trigger phrases
 */
export function createToolDefinitionWithTriggers(
	name: string = 'trigger_tool'
): McpToolDefinition {
	return {
		...createMockToolDefinition({ name }),
		triggerPhrases: [
			'find something',
			'search for X',
			'locate the Y',
			'where is Z',
			'show me all',
		],
	};
}

/**
 * Create a tool example
 */
export function createMockToolExample(
	overrides: Partial<ToolExample> = {}
): ToolExample {
	return {
		title: 'Test Example',
		description: 'A test example for unit testing',
		parameters: { test: 'value' },
		expectedOutcome: 'Expected test outcome',
		...overrides,
	};
}

/**
 * Create a mock config context
 */
export function createMockConfigContext(overrides: Record<string, any> = {}): {
	config: { apiUrl: string };
	projectId: string;
	branchName: string;
	namespace: string;
	apiKey: string;
	initializationError: string | null;
} {
	return {
		config: { apiUrl: 'http://localhost:3000' },
		projectId: 'test-project-id',
		branchName: 'main',
		namespace: 'test-namespace',
		apiKey: 'test-api-key-12345',
		initializationError: null,
		...overrides,
	};
}

/**
 * Create a mock sandbox result
 */
export function createMockSandboxResult(overrides: Record<string, any> = {}): {
	success: boolean;
	result?: any;
	error?: string;
	logs: string[];
	executionTime: number;
} {
	return {
		success: true,
		result: { data: 'test result' },
		logs: [],
		executionTime: 50,
		...overrides,
	};
}

/**
 * Create multiple tool definitions for bulk testing
 */
export function createToolDefinitionSet(): McpToolDefinition[] {
	return [
		createMockToolDefinition({
			name: 'discovery_tool',
			category: 'Discovery',
			description:
				'A discovery tool for finding symbols. Use it to search across the codebase. Great for exploring unfamiliar code.',
			relatedTools: ['dependency_tool'], // References tools that exist in the set
		}),
		createMockToolDefinition({
			name: 'dependency_tool',
			category: 'Dependency',
			description:
				'A dependency analysis tool. Use it to find what depends on what. Essential for refactoring safely.',
			relatedTools: ['discovery_tool'],
		}),
		createMockToolDefinition({
			name: 'impact_tool',
			category: 'Impact',
			description:
				'An impact analysis tool for changes. Use it to understand change consequences. Helps prevent breaking changes.',
			relatedTools: ['dependency_tool', 'discovery_tool'],
		}),
	];
}
