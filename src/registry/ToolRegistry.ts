/**
 * Tool Registry
 *
 * Central registry for enhanced MCP tool definitions.
 * Provides validation and enumeration of tools.
 */

import {
	McpToolDefinition,
	ToolCategory,
	validateToolDefinition,
} from './McpToolDefinition.interface';

/**
 * Tool Registry class
 *
 * Manages registration and validation of enhanced tool definitions
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
				`Invalid tool definition for '${definition.name}':\n${validation.errors?.join('\n')}`,
			);
		}

		// Check for duplicates
		if (this.tools.has(definition.name)) {
			throw new Error(`Tool '${definition.name}' is already registered`);
		}

		// Register tool
		this.tools.set(definition.name, definition);

		// Add to category index
		if (!this.toolsByCategory.has(definition.category)) {
			this.toolsByCategory.set(definition.category, new Set());
		}
		this.toolsByCategory.get(definition.category)!.add(definition.name);

		console.error(
			`[ToolRegistry] Registered tool: ${definition.name} (${definition.category})`,
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
	 * Get all registered tools
	 *
	 * @returns Array of all tool definitions
	 */
	getAllTools(): McpToolDefinition[] {
		return Array.from(this.tools.values());
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
						`Tool '${tool.name}' references non-existent related tool '${relatedName}'`,
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
							`Tool '${tool.name}' example ${i + 1} ('${example.title}') missing required parameter '${requiredParam}'`,
						);
					}
				}
			}

			// Warn if no examples provided
			if (tool.examples.length === 0) {
				warnings.push(`Tool '${tool.name}' has no examples (recommended: 2-3)`);
			}

			// Warn if use cases are too few
			if (tool.whenToUse.length < 3) {
				warnings.push(
					`Tool '${tool.name}' has only ${tool.whenToUse.length} use cases (recommended: 3-5)`,
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
	 * Validate integration with McpServer
	 *
	 * Since the official SDK doesn't expose registered tools, this method
	 * primarily validates that the registry is ready to provide metadata
	 * for tools that should be registered with the server.
	 *
	 * Note: In Code Mode, we only have one tool (query_code), so this
	 * validation is mostly for consistency and logging.
	 *
	 * @param server - The McpServer instance (for type checking)
	 * @returns Validation results
	 */
	validateWithMcpServer(server: any): {
		valid: boolean;
		warnings: string[];
	} {
		const warnings: string[] = [];

		// Ensure registry is initialized
		if (!this.initialized) {
			warnings.push('Tool registry not marked as initialized');
		}

		// Log available tool metadata
		const tools = this.getAllTools();
		console.error('[ToolRegistry] Available tool metadata:');
		for (const tool of tools) {
			console.error(
				`  - ${tool.name}: ${tool.examples.length} examples, ${tool.whenToUse.length} use cases`,
			);
		}

		// Validate that we have metadata for expected tools
		// In Code Mode, we should have query_code
		const hasQueryCode = this.tools.has('query_code');
		if (!hasQueryCode) {
			warnings.push('Missing metadata for query_code tool');
		}

		return {
			valid: warnings.length === 0,
			warnings,
		};
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
