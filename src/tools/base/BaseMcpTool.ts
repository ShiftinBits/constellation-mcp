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
import { getConfigContext } from '../../config/config-manager.js';
import { ConstellationClient, McpToolResult } from '../../client/constellation-client.js';
import { mapErrorToMessage } from '../../client/error-mapper.js';

/**
 * Abstract base class for all Constellation MCP tools
 *
 * Implements the MCP Tool interface and provides common utilities
 */
export abstract class BaseMcpTool<TInput, TOutput = string> extends MCPTool<TInput> {
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
	 * @param input Tool-specific input parameters
	 * @returns Formatted result string for AI consumption
	 */
	async execute(input: TInput): Promise<string> {
		try {
			// Get client and context
			const client = this.getClient();
			const context = this.getProjectContext();

			// Execute the tool via API
			const result: McpToolResult<TOutput> = await client.executeMcpTool(
				this.name,
				input,
				context
			);

			// Handle tool execution failure
			if (!result.success) {
				const errorMessage = result.error || 'Tool execution failed';
				throw new Error(errorMessage);
			}

			// Format the result for AI consumption
			return this.formatResult(result.data!, result.metadata);
		} catch (error) {
			// Map error to helpful message
			const helpfulMessage = mapErrorToMessage(error, this.name);
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
}
