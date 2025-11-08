/**
 * Enhanced MCP Tool Definition Interface
 *
 * Provides rich, descriptive metadata for MCP tools to help AI agents
 * understand when and how to use each tool effectively.
 */

import { z } from 'zod';

/**
 * Example usage pattern for a tool
 *
 * Shows concrete parameter combinations for common scenarios
 */
export interface ToolExample {
	/**
	 * Short title describing the use case
	 * Example: "Basic symbol search"
	 */
	title: string;

	/**
	 * Detailed description of what this example demonstrates
	 * Example: "Find all symbols containing 'User' across the codebase"
	 */
	description: string;

	/**
	 * Actual parameter values for this example
	 * Must match the tool's input schema
	 */
	parameters: Record<string, any>;

	/**
	 * Optional: Expected outcome or what the AI should look for
	 * Example: "Returns list of classes, interfaces, and functions with 'User' in name"
	 */
	expectedOutcome?: string;
}

/**
 * Tool category for organization
 */
export type ToolCategory =
	| 'Discovery'
	| 'Dependency'
	| 'Impact'
	| 'Architecture'
	| 'Refactoring';

/**
 * Enhanced MCP Tool Definition
 *
 * Extends basic MCP tool metadata with AI-friendly guidance
 */
export interface McpToolDefinition {
	/**
	 * Unique tool name (must match actual tool implementation)
	 * Format: snake_case
	 * Example: "search_symbols"
	 */
	name: string;

	/**
	 * Tool category for organization
	 */
	category: ToolCategory;

	/**
	 * Rich description (2-3 sentences) explaining:
	 * - What the tool does
	 * - When to use it
	 * - How it differs from similar tools
	 *
	 * Example: "Search for symbols (functions, classes, variables) across your codebase
	 * by name or pattern. Use this when you need to find where a symbol is defined or
	 * explore available symbols. For detailed information about a specific symbol,
	 * use get_symbol_details instead."
	 */
	description: string;

	/**
	 * Short summary (1 sentence) for quick reference
	 * Used in tool lists and logs
	 */
	shortDescription?: string;

	/**
	 * List of common use cases (3-5 bullet points)
	 * Helps AI agents map user intent to tools
	 *
	 * Example:
	 * - Finding where a function/class is defined
	 * - Exploring available APIs in a module
	 * - Locating symbols with similar names
	 */
	whenToUse: string[];

	/**
	 * Related tools that might be used before/after this one
	 * Helps AI agents chain tools effectively
	 *
	 * Example: ["get_symbol_details", "search_symbols", "trace_symbol_usage"]
	 */
	relatedTools: string[];

	/**
	 * JSON Schema for tool input parameters
	 * Enhanced with detailed descriptions and examples
	 */
	inputSchema: {
		type: 'object';
		properties: Record<string, any>;
		required?: string[];
		additionalProperties?: boolean;
	};

	/**
	 * 2-3 concrete usage examples showing common scenarios
	 * Each example includes actual parameter values
	 */
	examples: ToolExample[];

	/**
	 * Optional: Common mistakes to avoid
	 * Helps prevent parameter errors
	 *
	 * Example:
	 * - "Don't use both symbolId and symbolName - choose one approach"
	 * - "Set depth to 1 for initial exploration to avoid overwhelming results"
	 */
	commonMistakes?: string[];

	/**
	 * Optional: Version when tool was introduced
	 * Useful for compatibility checking
	 */
	sinceVersion?: string;
}

/**
 * Validation schema for McpToolDefinition
 * Ensures all definitions meet quality standards
 */
export const McpToolDefinitionSchema = z.object({
	name: z
		.string()
		.min(3)
		.max(100)
		.regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case'),

	category: z.enum([
		'Discovery',
		'Dependency',
		'Impact',
		'Architecture',
		'Refactoring',
	]),

	description: z
		.string()
		.min(50)
		.max(500)
		.refine(
			(desc) => desc.split('.').length >= 2,
			'Description should be 2-3 sentences'
		),

	shortDescription: z.string().max(200).optional(),

	whenToUse: z
		.array(z.string().min(10).max(200))
		.min(3)
		.max(7)
		.describe('3-7 use case bullet points'),

	relatedTools: z
		.array(z.string())
		.min(1)
		.max(10)
		.describe('1-10 related tool names'),

	inputSchema: z.object({
		type: z.literal('object'),
		properties: z.record(z.any()),
		required: z.array(z.string()).optional(),
		additionalProperties: z.boolean().optional(),
	}),

	examples: z
		.array(
			z.object({
				title: z.string().min(5).max(100),
				description: z.string().min(10).max(300),
				parameters: z.record(z.any()),
				expectedOutcome: z.string().optional(),
			})
		)
		.min(2)
		.max(5)
		.describe('2-5 concrete examples'),

	commonMistakes: z.array(z.string()).optional(),
	performanceNotes: z.array(z.string()).optional(),
	sinceVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
});

/**
 * Type guard to check if object is a valid McpToolDefinition
 */
export function isValidToolDefinition(
	obj: any
): obj is McpToolDefinition {
	const result = McpToolDefinitionSchema.safeParse(obj);
	return result.success;
}

/**
 * Validate and return detailed errors for invalid definitions
 */
export function validateToolDefinition(
	obj: any
): { valid: boolean; errors?: string[] } {
	const result = McpToolDefinitionSchema.safeParse(obj);
	if (result.success) {
		return { valid: true };
	}

	const errors = result.error.errors.map(
		(err) => `${err.path.join('.')}: ${err.message}`
	);
	return { valid: false, errors };
}
