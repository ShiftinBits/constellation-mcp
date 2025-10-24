/**
 * Tool Selector Utility
 *
 * Helper functions for AI agents to discover and select appropriate tools
 * based on intent, use case, and parameters.
 */

import { getToolRegistry } from './ToolRegistry.js';
import { McpToolDefinition, ToolExample } from './McpToolDefinition.interface.js';

/**
 * Suggest tools based on user intent keywords
 *
 * Analyzes intent keywords and returns ranked list of relevant tools.
 *
 * @param intentKeywords - Array of keywords describing user intent
 * @returns Array of tool definitions sorted by relevance
 *
 * @example
 * ```typescript
 * const tools = suggestToolsForIntent(['find', 'function', 'usage']);
 * // Returns: [trace_symbol_usage, search_symbols, get_symbol_details, ...]
 * ```
 */
export function suggestToolsForIntent(intentKeywords: string[]): McpToolDefinition[] {
	const registry = getToolRegistry();
	return registry.findToolsByIntent(intentKeywords);
}

/**
 * Get examples for a specific tool
 *
 * Retrieves concrete usage examples to help AI understand parameters.
 *
 * @param toolName - Name of the tool
 * @returns Array of tool examples
 *
 * @example
 * ```typescript
 * const examples = getToolExamples('search_symbols');
 * // Returns examples with parameter combinations
 * ```
 */
export function getToolExamples(toolName: string): ToolExample[] {
	const registry = getToolRegistry();
	return registry.getToolExamples(toolName);
}

/**
 * Validate tool parameters against schema
 *
 * Checks if provided parameters match the tool's input schema.
 *
 * @param toolName - Name of the tool
 * @param parameters - Parameters to validate
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * const result = validateToolParameters('search_symbols', { query: 'User' });
 * // Returns: { valid: true }
 * ```
 */
export function validateToolParameters(
	toolName: string,
	parameters: Record<string, any>
): { valid: boolean; errors?: string[] } {
	const registry = getToolRegistry();
	const tool = registry.getToolByName(toolName);

	if (!tool) {
		return {
			valid: false,
			errors: [`Tool '${toolName}' not found in registry`],
		};
	}

	const errors: string[] = [];

	// Check required parameters
	const required = tool.inputSchema.required || [];
	for (const requiredParam of required) {
		if (!(requiredParam in parameters)) {
			errors.push(`Missing required parameter: ${requiredParam}`);
		}
	}

	// Check for unknown parameters
	const validParams = Object.keys(tool.inputSchema.properties);
	for (const param of Object.keys(parameters)) {
		if (!validParams.includes(param)) {
			errors.push(`Unknown parameter: ${param}. Valid parameters: ${validParams.join(', ')}`);
		}
	}

	return {
		valid: errors.length === 0,
		errors: errors.length > 0 ? errors : undefined,
	};
}

/**
 * Get related tools for a specific tool
 *
 * Returns tools commonly used before or after the specified tool.
 *
 * @param toolName - Name of the tool
 * @returns Array of related tool definitions
 *
 * @example
 * ```typescript
 * const related = getRelatedTools('search_symbols');
 * // Returns: [get_symbol_details, trace_symbol_usage, ...]
 * ```
 */
export function getRelatedTools(toolName: string): McpToolDefinition[] {
	const registry = getToolRegistry();
	return registry.getRelatedTools(toolName);
}

/**
 * Find the best tool for a specific use case
 *
 * Analyzes use case description and returns most appropriate tool.
 *
 * @param useCase - Description of what you want to do
 * @returns Best matching tool or undefined if no good match
 *
 * @example
 * ```typescript
 * const tool = findToolForUseCase('I want to find where a function is called');
 * // Returns: trace_symbol_usage tool definition
 * ```
 */
export function findToolForUseCase(useCase: string): McpToolDefinition | undefined {
	const keywords = useCase
		.toLowerCase()
		.split(/\s+/)
		.filter((word) => word.length > 3); // Filter out short words

	const tools = suggestToolsForIntent(keywords);
	return tools.length > 0 ? tools[0] : undefined;
}

/**
 * Get tool usage tips and common mistakes
 *
 * Returns helpful guidance for using a tool correctly.
 *
 * @param toolName - Name of the tool
 * @returns Object with common mistakes and performance notes
 */
export function getToolUsageTips(
	toolName: string
): {
	commonMistakes?: string[];
	performanceNotes?: string[];
	relatedTools: string[];
} {
	const registry = getToolRegistry();
	const tool = registry.getToolByName(toolName);

	if (!tool) {
		return { relatedTools: [] };
	}

	return {
		commonMistakes: tool.commonMistakes,
		performanceNotes: tool.performanceNotes,
		relatedTools: tool.relatedTools,
	};
}

/**
 * Get a human-readable summary of a tool
 *
 * Returns formatted description suitable for displaying to users.
 *
 * @param toolName - Name of the tool
 * @returns Formatted tool summary
 */
export function getToolSummary(toolName: string): string {
	const registry = getToolRegistry();
	const tool = registry.getToolByName(toolName);

	if (!tool) {
		return `Tool '${toolName}' not found`;
	}

	let summary = `${tool.name} (${tool.category})\n`;
	summary += `${'='.repeat(tool.name.length + tool.category.length + 3)}\n\n`;
	summary += `${tool.description}\n\n`;

	summary += `When to use:\n`;
	for (const useCase of tool.whenToUse) {
		summary += `  • ${useCase}\n`;
	}

	summary += `\nRelated tools: ${tool.relatedTools.join(', ')}\n`;

	if (tool.examples.length > 0) {
		summary += `\nExamples: ${tool.examples.length} available\n`;
	}

	return summary;
}

/**
 * Compare two tools
 *
 * Returns comparison highlighting differences and when to use each.
 *
 * @param toolName1 - First tool name
 * @param toolName2 - Second tool name
 * @returns Comparison result
 */
export function compareTools(
	toolName1: string,
	toolName2: string
): {
	tool1: { name: string; category: string; description: string };
	tool2: { name: string; category: string; description: string };
	differences: string[];
} | null {
	const registry = getToolRegistry();
	const tool1 = registry.getToolByName(toolName1);
	const tool2 = registry.getToolByName(toolName2);

	if (!tool1 || !tool2) {
		return null;
	}

	const differences: string[] = [];

	// Category difference
	if (tool1.category !== tool2.category) {
		differences.push(
			`${tool1.name} is for ${tool1.category}, ${tool2.name} is for ${tool2.category}`
		);
	}

	// Required parameters
	const req1 = tool1.inputSchema.required || [];
	const req2 = tool2.inputSchema.required || [];
	if (req1.length !== req2.length) {
		differences.push(
			`${tool1.name} requires ${req1.length} parameters, ${tool2.name} requires ${req2.length}`
		);
	}

	// Example count
	if (tool1.examples.length !== tool2.examples.length) {
		differences.push(
			`${tool1.name} has ${tool1.examples.length} examples, ${tool2.name} has ${tool2.examples.length}`
		);
	}

	return {
		tool1: {
			name: tool1.name,
			category: tool1.category,
			description: tool1.description,
		},
		tool2: {
			name: tool2.name,
			category: tool2.category,
			description: tool2.description,
		},
		differences,
	};
}
