/**
 * Execute Code Tool Registration
 *
 * Registers the execute_code tool with the MCP server.
 * This is the only tool in Code Mode, providing access to all Constellation API capabilities
 * through JavaScript code execution.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CodeModeRuntime } from '../code-mode/runtime.js';
import { getConfigContext } from '../config/config-manager.js';
import { standardErrors } from '../utils/error-messages.js';

/**
 * Register the execute_code tool with the MCP server
 *
 * @param server - The McpServer instance to register the tool with
 */
export function registerExecuteCodeTool(server: McpServer): void {
	server.registerTool(
		'execute_code',
		{
			title: 'Execute JavaScript Code',
			description:
				'THE ONLY AVAILABLE TOOL. Execute JavaScript code to interact with Constellation. ' +
				'You MUST use this tool for ALL operations - searching, analyzing dependencies, getting details, etc. ' +
				'Write JavaScript code using the api object: api.searchSymbols(), api.getDependencies(), api.traceSymbolUsage(), etc. ' +
				'This is a Code Mode-only server. There are NO other tools. Always write JavaScript code.',
			inputSchema: {
				code: z.string().min(1).describe(
					'JavaScript code to execute. Can use top-level await. ' +
					'Available API methods: searchSymbols, getSymbolDetails, getDependencies, ' +
					'getDependents, findCircularDependencies, traceSymbolUsage, getCallGraph, ' +
					'findOrphanedCode, impactAnalysis, getArchitectureOverview'
				),
				timeout: z
					.number()
					.min(1000)
					.max(60000)
					.optional()
					.default(30000)
					.describe('Maximum execution time in milliseconds (default: 30000, max: 60000)'),
			},
			outputSchema: {
				success: z.boolean(),
				result: z.any().optional(),
				logs: z.array(z.string()).optional(),
				time: z.number().optional(),
				error: z.string().optional(),
			},
		},
		async ({ code, timeout }) => {
			console.error('[execute_code] Executing code mode script');

			try {
				// Check for configuration errors first
				const configContext = getConfigContext();
				if (configContext.initializationError) {
					console.error('[execute_code] Configuration error detected, returning setup instructions');
					const errorMessage = standardErrors.configurationError(
						configContext.initializationError,
						process.cwd()
					);

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

				// Create runtime with configuration
				const runtime = new CodeModeRuntime({
					timeout: timeout || 30000,
					allowConsole: true,
					allowTimers: false,
				});

				// Execute the code
				const response = await runtime.execute({
					code,
					timeout,
				});

				// Format the result
				const formatted = runtime.formatResult(response);

				console.error('[execute_code] Execution successful');

				// Return both text and structured content
				return {
					content: [
						{
							type: 'text',
							text: formatted,
						},
					],
					structuredContent: response, // Optional: provides structured data for clients that support it
				};
			} catch (error) {
				console.error('[execute_code] Execution error:', error);

				const errorMessage = JSON.stringify(
					{
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
					null,
					2
				);

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
		}
	);

	console.error('[execute_code] Tool registered successfully');
}
