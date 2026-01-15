/**
 * Execute Code Tool Registration
 *
 * Registers the execute_code tool with the MCP server.
 * This is the only tool in Code Mode, providing access to all Constellation API capabilities
 * through JavaScript code execution.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CodeModeRuntime, CodeModeResponse } from '../code-mode/runtime.js';
import { getConfigContext } from '../config/config-manager.js';
import { standardErrors } from '../utils/error-messages.js';
import { createStructuredError } from '../client/error-factory.js';
import { ConfigurationError } from '../client/constellation-client.js';
import { ErrorCode } from '../types/mcp-errors.js';

/**
 * Input validation constants
 * FIX SB-87: Prevent DoS via large code submissions
 */
const MAX_CODE_SIZE = 100 * 1024; // 100KB limit for code input

/**
 * Regex to detect invalid binary/control characters in code
 * Allows common whitespace (\t \n \r) but rejects other control chars
 */
const BINARY_CHAR_PATTERN = /[\x00-\x08\x0E-\x1F]/;

/**
 * Output schema type for MCP compliance.
 * Must match the outputSchema declared in registerTool.
 * Index signature required for MCP SDK compatibility.
 */
interface SchemaCompliantOutput {
	success: boolean;
	result?: any;
	logs?: string[];
	time?: number;
	error?: string;
	[x: string]: unknown;
}

/**
 * Transform CodeModeResponse to match the declared outputSchema.
 * This ensures strict MCP clients (like Google Gemini CLI) don't reject
 * the response due to additional properties not in the schema.
 */
function toSchemaCompliantOutput(
	response: CodeModeResponse,
): SchemaCompliantOutput {
	const output: SchemaCompliantOutput = {
		success: response.success,
	};

	if (response.success) {
		if (response.result !== undefined) output.result = response.result;
		if (response.logs?.length) output.logs = response.logs;
		if (response.executionTime) output.time = response.executionTime;
	} else {
		if (response.error) output.error = response.error;
		if (response.logs?.length) output.logs = response.logs;
	}

	return output;
}

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
				code: z
					.string()
					.min(1)
					.describe(
						'JavaScript code to execute. Can use top-level await. ' +
							'Available API methods: searchSymbols, getSymbolDetails, getDependencies, ' +
							'getDependents, findCircularDependencies, traceSymbolUsage, getCallGraph, ' +
							'findOrphanedCode, impactAnalysis, getArchitectureOverview',
					),
				timeout: z
					.number()
					.min(1000)
					.max(60000)
					.optional()
					.default(30000)
					.describe(
						'Maximum execution time in milliseconds (default: 30000, max: 60000)',
					),
			},
			outputSchema: {
				success: z.boolean(),
				result: z.any().optional(),
				logs: z.array(z.string()).optional(),
				time: z.number().optional(),
				error: z.string().optional(),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ code, timeout }) => {
			console.error('[execute_code] Executing code mode script');

			try {
				// Check for configuration errors first
				const configContext = getConfigContext();
				if (configContext.initializationError) {
					console.error(
						'[execute_code] Configuration error detected, returning setup instructions',
					);

					// Create structured error for configuration issues
					const structuredError = createStructuredError(
						new ConfigurationError(configContext.initializationError),
						'execute_code',
					);

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(structuredError, null, 2),
							},
						],
						isError: true,
					};
				}

				// FIX SB-87: Validate code size to prevent DoS attacks
				if (code.length > MAX_CODE_SIZE) {
					console.error(
						`[execute_code] Code too large: ${code.length} bytes (max ${MAX_CODE_SIZE})`,
					);
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(
									{
										success: false,
										error: {
											code: ErrorCode.VALIDATION_ERROR,
											type: 'ValidationError',
											message: `Code size (${code.length} bytes) exceeds maximum allowed (${MAX_CODE_SIZE} bytes / 100KB)`,
											recoverable: true,
											guidance: [
												'Reduce code size by removing unnecessary code',
												'Break large operations into smaller steps',
												'Move data to API calls instead of embedding in code',
											],
										},
										formattedMessage: `Code too large: ${code.length} bytes exceeds ${MAX_CODE_SIZE} byte limit`,
									},
									null,
									2,
								),
							},
						],
						isError: true,
					};
				}

				// FIX SB-87: Check for binary/control characters
				if (BINARY_CHAR_PATTERN.test(code)) {
					console.error(
						'[execute_code] Code contains invalid binary characters',
					);
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(
									{
										success: false,
										error: {
											code: ErrorCode.VALIDATION_ERROR,
											type: 'ValidationError',
											message:
												'Code contains invalid binary or control characters',
											recoverable: true,
											guidance: [
												'Ensure code is valid UTF-8 text',
												'Remove any binary data or control characters',
												'Check for encoding issues in your code editor',
											],
										},
										formattedMessage:
											'Code contains invalid binary characters - only text is allowed',
									},
									null,
									2,
								),
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

				// Check if response contains a structured error (from API/sandbox)
				if (response.structuredError) {
					console.error('[execute_code] Execution returned structured error');

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(response.structuredError, null, 2),
							},
						],
						isError: true,
					};
				}

				// Format the result for successful execution
				const formatted = runtime.formatResult(response);

				console.error('[execute_code] Execution successful');

				// Return both text and structured content (schema-compliant)
				return {
					content: [
						{
							type: 'text',
							text: formatted,
						},
					],
					structuredContent: toSchemaCompliantOutput(response),
				};
			} catch (error) {
				console.error('[execute_code] Execution error:', error);

				// Create structured error for unexpected errors
				const structuredError = createStructuredError(error, 'execute_code');

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(structuredError, null, 2),
						},
					],
					isError: true,
				};
			}
		},
	);

	console.error('[execute_code] Tool registered successfully');
}
