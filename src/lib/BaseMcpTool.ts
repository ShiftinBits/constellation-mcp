/**
 * Base MCP Tool - Abstract base class for all Constellation MCP tools
 *
 * Provides common functionality:
 * - HTTP client management
 * - Configuration access
 * - Error handling and mapping
 * - Response formatting
 */

import { MCPTool } from 'mcp-framework';
import { getConfigContext } from '../config/config-manager.js';
import { ConstellationClient, McpToolResult } from '../client/constellation-client.js';
import { mapErrorToMessage } from '../client/error-mapper.js';
import { generateSymbolId } from '../utils/symbol-id.utils.js';
import { getToolRegistry } from '../registry/ToolRegistry.js';
import { McpToolDefinition } from '../registry/McpToolDefinition.interface.js';
import { standardErrors } from '../utils/error-messages.js';

/**
 * Abstract base class for all Constellation MCP tools
 *
 * Implements the MCP Tool interface and provides common utilities
 */
export abstract class BaseMcpTool<TInput extends Record<string, any>, TOutput = string> extends MCPTool<TInput> {
	/**
	 * Get the HTTP client for API communication
	 *
	 * Creates a new client instance with current configuration
	 */
	protected getClient(): ConstellationClient {
		const context = getConfigContext();

		if (!context.apiKey) {
			throw new Error(
				'API key not configured. Set CONSTELLATION_API_KEY environment variable.'
			);
		}

		return new ConstellationClient(context.config, context.apiKey);
	}

	/**
	 * Get the current project context (project ID and branch)
	 *
	 * Returns auto-detected values from git or configuration
	 */
	protected getProjectContext(): { projectId: string; branchName: string } {
		const context = getConfigContext();
		return {
			projectId: context.projectId,
			branchName: context.branchName,
		};
	}

	/**
	 * Execute the tool by calling the Constellation API
	 *
	 * This is the main entry point called by the MCP framework.
	 * Handles the full request lifecycle:
	 * 1. Get HTTP client and context
	 * 2. Call API via executeMcpTool()
	 * 3. Format the result for AI consumption
	 * 4. Handle errors with helpful messages
	 *
	 * NOTE: This method NEVER throws errors. All errors are converted to
	 * user-friendly text messages and returned as regular content. This ensures
	 * compatibility with Claude Code which doesn't support error content types.
	 *
	 * @param input Tool-specific input parameters
	 * @returns Formatted result string for AI consumption (never throws)
	 */
	async execute(input: TInput): Promise<string> {
		console.error(`[BaseMcpTool] execute() called for tool: ${this.name}`);
		console.error(`[BaseMcpTool] input:`, JSON.stringify(input));
		try {
			// Check for initialization errors first
			const configContext = getConfigContext();
			if (configContext.initializationError) {
				console.error(`[BaseMcpTool] Configuration error detected, returning setup instructions`);
				return standardErrors.configurationError(
					configContext.initializationError,
					process.cwd()
				);
			}

			// Get client and context
			const client = this.getClient();
			const context = this.getProjectContext();
			console.error(`[BaseMcpTool] context:`, context);

			// Execute the tool via API
			const result: McpToolResult<TOutput> = await client.executeMcpTool(
				this.name,
				input,
				context
			);
			console.error(`[BaseMcpTool] API result success:`, result.success);

			// Handle tool execution failure - return error as text, don't throw
			if (!result.success) {
				const errorMessage = result.error || 'Tool execution failed';
				console.error(`[BaseMcpTool] Returning error as text:`, errorMessage);
				// Map to helpful message and return as text
				return mapErrorToMessage(new Error(errorMessage), this.name);
			}

			// Format the result for AI consumption
			console.error(`[BaseMcpTool] Formatting successful result`);
			const formatted = this.formatResult(result.data!, result.metadata);
			console.error(`[BaseMcpTool] Formatted result length:`, formatted.length);
			return formatted;
		} catch (error) {
			// Map error to helpful message and return as text (never throw)
			console.error(`[BaseMcpTool] Caught exception:`, error);
			const helpfulMessage = mapErrorToMessage(error, this.name);
			console.error(`[BaseMcpTool] Returning error message as text`);
			return helpfulMessage;
		}
	}

	/**
	 * Format the API result for AI consumption
	 *
	 * Override this method to customize output formatting for each tool.
	 * By default, returns JSON string representation.
	 *
	 * @param data Result data from API
	 * @param metadata Execution metadata
	 * @returns Formatted string for AI consumption
	 */
	protected formatResult(
		data: TOutput,
		metadata: { executionTime: number; cached: boolean; [key: string]: any }
	): string {
		// Default implementation: JSON stringify
		// Subclasses should override for better formatting
		return JSON.stringify(data, null, 2);
	}

	/**
	 * Get configuration context
	 *
	 * Convenience method for accessing configuration in subclasses
	 */
	protected getConfig() {
		return getConfigContext();
	}

	/**
	 * Generate a symbol ID from file path and symbol name
	 *
	 * Uses the current project context (namespace and branch) to generate
	 * a properly formatted symbol ID for API calls.
	 *
	 * @param filePath - Relative file path from project root
	 * @param symbolName - Name of the symbol
	 * @returns Base64-encoded SHA-224 hash symbol ID
	 *
	 * @example
	 * ```typescript
	 * const symbolId = this.generateSymbolId(
	 *   'src/controllers/health.controller.ts',
	 *   'HealthController'
	 * );
	 * ```
	 */
	protected generateSymbolId(filePath: string, symbolName: string): string {
		const context = this.getProjectContext();
		return generateSymbolId(
			context.projectId,
			context.branchName,
			filePath,
			symbolName
		);
	}

	/**
	 * Override mcp-framework's createErrorResponse to return MCP-spec-compliant format
	 *
	 * The mcp-framework has a bug where it returns {type: "error"} which violates
	 * the MCP specification. The spec requires {type: "text", isError: true}.
	 *
	 * This override ensures all error responses follow the specification.
	 */
	protected createErrorResponse(error: Error): { content: Array<{ type: 'text'; text: string }>; isError: boolean } {
		const errorMessage = mapErrorToMessage(error, this.name);
		return {
			content: [
				{
					type: 'text',
					text: errorMessage,
				},
			],
			isError: true,
		};
	}

	/**
	 * Get the enhanced tool definition for this tool
	 *
	 * Returns rich metadata including description, examples, use cases, and more.
	 * Useful for AI agents to understand when and how to use the tool.
	 *
	 * @returns Enhanced tool definition or undefined if not found in registry
	 */
	getEnhancedDefinition(): McpToolDefinition | undefined {
		const registry = getToolRegistry();
		return registry.getToolByName(this.name);
	}

	/**
	 * Get usage examples for this tool
	 *
	 * Returns concrete parameter combinations for common scenarios.
	 *
	 * @returns Array of tool examples
	 */
	getExamples() {
		const definition = this.getEnhancedDefinition();
		return definition?.examples || [];
	}

	/**
	 * Get use cases for this tool
	 *
	 * Returns list of scenarios when this tool should be used.
	 *
	 * @returns Array of use case descriptions
	 */
	getUseCases(): string[] {
		const definition = this.getEnhancedDefinition();
		return definition?.whenToUse || [];
	}

	/**
	 * Get related tools
	 *
	 * Returns tools commonly used before or after this one.
	 *
	 * @returns Array of related tool names
	 */
	getRelatedTools(): string[] {
		const definition = this.getEnhancedDefinition();
		return definition?.relatedTools || [];
	}

	/**
	 * Get common mistakes to avoid
	 *
	 * Returns guidance on pitfalls when using this tool.
	 *
	 * @returns Array of common mistake descriptions
	 */
	getCommonMistakes(): string[] {
		const definition = this.getEnhancedDefinition();
		return definition?.commonMistakes || [];
	}
}
