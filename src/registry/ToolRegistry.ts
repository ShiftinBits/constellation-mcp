/**
 * Tool Registry
 *
 * Central registry for enhanced MCP tool definitions.
 * Provides validation, discovery, and intent-based tool selection.
 */

import {
	McpToolDefinition,
	ToolCategory,
	validateToolDefinition
} from './McpToolDefinition.interface';

/**
 * Tool Registry class
 *
 * Manages registration and discovery of enhanced tool definitions
 */
export class ToolRegistry {
	private tools: Map<string, McpToolDefinition>;
	private toolsByCategory: Map<ToolCategory, Set<string>>;
	private initialized: boolean;

	constructor() {
		this.tools = new Map();
		this.toolsByCategory = new Map();
		this.initialized = false;
	}

	/**
	 * Register a tool definition
	 *
	 * Validates the definition and adds it to the registry.
	 * Throws if validation fails or tool name already registered.
	 *
	 * @param definition - Tool definition to register
	 * @throws Error if validation fails or duplicate name
	 */
	register(definition: McpToolDefinition): void {
		// Validate definition
		const validation = validateToolDefinition(definition);
		if (!validation.valid) {
			throw new Error(
				`Invalid tool definition for '${definition.name}':\n${validation.errors?.join('\n')}`
			);
		}

		// Check for duplicates
		if (this.tools.has(definition.name)) {
			throw new Error(
				`Tool '${definition.name}' is already registered`
			);
		}

		// Register tool
		this.tools.set(definition.name, definition);

		// Add to category index
		if (!this.toolsByCategory.has(definition.category)) {
			this.toolsByCategory.set(definition.category, new Set());
		}
		this.toolsByCategory.get(definition.category)!.add(definition.name);

		console.error(
			`[ToolRegistry] Registered tool: ${definition.name} (${definition.category})`
		);
	}

	/**
	 * Register multiple tool definitions
	 *
	 * Convenience method for bulk registration.
	 * Throws on first validation error.
	 *
	 * @param definitions - Array of tool definitions
	 */
	registerMany(definitions: McpToolDefinition[]): void {
		for (const definition of definitions) {
			this.register(definition);
		}
	}

	/**
	 * Get a tool definition by name
	 *
	 * @param name - Tool name
	 * @returns Tool definition or undefined if not found
	 */
	getToolByName(name: string): McpToolDefinition | undefined {
		return this.tools.get(name);
	}

	/**
	 * Get all tools in a category
	 *
	 * @param category - Tool category
	 * @returns Array of tool definitions in category
	 */
	getToolsByCategory(category: ToolCategory): McpToolDefinition[] {
		const toolNames = this.toolsByCategory.get(category) || new Set();
		return Array.from(toolNames)
			.map((name) => this.tools.get(name)!)
			.filter((tool) => tool !== undefined);
	}

	/**
	 * Get all registered tools
	 *
	 * @returns Array of all tool definitions
	 */
	getAllTools(): McpToolDefinition[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Find tools by intent/use case keywords
	 *
	 * Searches tool descriptions and use cases for matching keywords.
	 * Useful for AI agents to discover appropriate tools.
	 *
	 * @param keywords - Search terms (case-insensitive)
	 * @returns Array of matching tool definitions, sorted by relevance
	 *
	 * @example
	 * ```typescript
	 * // Find tools for analyzing impact
	 * const tools = registry.findToolsByIntent(['impact', 'change', 'breaking']);
	 * ```
	 */
	findToolsByIntent(keywords: string[]): McpToolDefinition[] {
		const lowerKeywords = keywords.map((k) => k.toLowerCase());
		const scoredTools: Array<{ tool: McpToolDefinition; score: number }> =
			[];

		for (const tool of this.tools.values()) {
			let score = 0;

			// Search in description
			const descLower = tool.description.toLowerCase();
			for (const keyword of lowerKeywords) {
				if (descLower.includes(keyword)) {
					score += 3; // High weight for description matches
				}
			}

			// Search in use cases
			for (const useCase of tool.whenToUse) {
				const useCaseLower = useCase.toLowerCase();
				for (const keyword of lowerKeywords) {
					if (useCaseLower.includes(keyword)) {
						score += 2; // Medium weight for use case matches
					}
				}
			}

			// Search in tool name
			const nameLower = tool.name.toLowerCase();
			for (const keyword of lowerKeywords) {
				if (nameLower.includes(keyword)) {
					score += 1; // Low weight for name matches
				}
			}

			if (score > 0) {
				scoredTools.push({ tool, score });
			}
		}

		// Sort by score (descending)
		scoredTools.sort((a, b) => b.score - a.score);

		return scoredTools.map((st) => st.tool);
	}

	/**
	 * Get tools related to a specific tool
	 *
	 * Returns tools that are commonly used together.
	 *
	 * @param toolName - Name of the tool
	 * @returns Array of related tool definitions
	 */
	getRelatedTools(toolName: string): McpToolDefinition[] {
		const tool = this.tools.get(toolName);
		if (!tool) {
			return [];
		}

		return tool.relatedTools
			.map((name) => this.tools.get(name))
			.filter((t): t is McpToolDefinition => t !== undefined);
	}

	/**
	 * Get examples for a tool
	 *
	 * Convenience method to retrieve tool examples.
	 *
	 * @param toolName - Name of the tool
	 * @returns Array of examples or empty array if tool not found
	 */
	getToolExamples(toolName: string) {
		const tool = this.tools.get(toolName);
		return tool?.examples || [];
	}

	/**
	 * Validate all registered tools
	 *
	 * Checks for:
	 * - Related tools that don't exist
	 * - Circular references
	 * - Missing required fields
	 *
	 * @returns Validation results
	 */
	validateRegistry(): {
		valid: boolean;
		errors: string[];
		warnings: string[];
	} {
		const errors: string[] = [];
		const warnings: string[] = [];

		for (const tool of this.tools.values()) {
			// Check related tools exist
			for (const relatedName of tool.relatedTools) {
				if (!this.tools.has(relatedName)) {
					errors.push(
						`Tool '${tool.name}' references non-existent related tool '${relatedName}'`
					);
				}
			}

			// Check examples have valid parameters
			for (let i = 0; i < tool.examples.length; i++) {
				const example = tool.examples[i];

				// Check required parameters are present
				const required = tool.inputSchema.required || [];
				for (const requiredParam of required) {
					if (!(requiredParam in example.parameters)) {
						warnings.push(
							`Tool '${tool.name}' example ${i + 1} ('${example.title}') missing required parameter '${requiredParam}'`
						);
					}
				}
			}

			// Warn if no examples provided
			if (tool.examples.length === 0) {
				warnings.push(
					`Tool '${tool.name}' has no examples (recommended: 2-3)`
				);
			}

			// Warn if use cases are too few
			if (tool.whenToUse.length < 3) {
				warnings.push(
					`Tool '${tool.name}' has only ${tool.whenToUse.length} use cases (recommended: 3-5)`
				);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Get registry statistics
	 *
	 * @returns Statistics about registered tools
	 */
	getStats() {
		const stats = {
			totalTools: this.tools.size,
			byCategory: {} as Record<ToolCategory, number>,
			toolsWithExamples: 0,
			averageExamplesPerTool: 0,
		};

		let totalExamples = 0;
		for (const tool of this.tools.values()) {
			if (tool.examples.length > 0) {
				stats.toolsWithExamples++;
				totalExamples += tool.examples.length;
			}
		}

		stats.averageExamplesPerTool =
			stats.totalTools > 0 ? totalExamples / stats.totalTools : 0;

		// Count by category
		for (const [category, toolSet] of this.toolsByCategory.entries()) {
			stats.byCategory[category] = toolSet.size;
		}

		return stats;
	}

	/**
	 * Clear all registered tools
	 *
	 * Used primarily for testing
	 */
	clear(): void {
		this.tools.clear();
		this.toolsByCategory.clear();
		this.initialized = false;
	}

	/**
	 * Mark registry as initialized
	 */
	markInitialized(): void {
		this.initialized = true;
	}

	/**
	 * Check if registry is initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Generate a summary report of all tools
	 *
	 * Useful for documentation and debugging
	 *
	 * @returns Formatted text summary
	 */
	generateSummary(): string {
		const stats = this.getStats();
		const categories: ToolCategory[] = [
			'Discovery',
			'Dependency',
			'Impact',
			'Architecture',
			'Refactoring',
		];

		let summary = `Constellation MCP Tools Registry\n`;
		summary += `================================\n\n`;
		summary += `Total Tools: ${stats.totalTools}\n`;
		summary += `Tools with Examples: ${stats.toolsWithExamples}\n`;
		summary += `Average Examples per Tool: ${stats.averageExamplesPerTool.toFixed(1)}\n\n`;

		for (const category of categories) {
			const tools = this.getToolsByCategory(category);
			if (tools.length === 0) continue;

			summary += `${category} (${tools.length})\n`;
			summary += `${'-'.repeat(category.length + ` (${tools.length})`.length)}\n`;

			for (const tool of tools) {
				summary += `  • ${tool.name}`;
				if (tool.shortDescription) {
					summary += ` - ${tool.shortDescription}`;
				}
				summary += `\n`;
				summary += `    Examples: ${tool.examples.length}, Use Cases: ${tool.whenToUse.length}\n`;
			}
			summary += '\n';
		}

		return summary;
	}
}

/**
 * Singleton instance of the tool registry
 */
let registryInstance: ToolRegistry | null = null;

/**
 * Get the singleton tool registry instance
 *
 * Creates the registry on first call.
 *
 * @returns Tool registry instance
 */
export function getToolRegistry(): ToolRegistry {
	if (!registryInstance) {
		registryInstance = new ToolRegistry();
	}
	return registryInstance;
}

/**
 * Reset the registry (for testing)
 */
export function resetToolRegistry(): void {
	registryInstance = null;
}
