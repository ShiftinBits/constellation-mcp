/**
 * Query Code Graph Tool Registration
 *
 * Registers the query_code_graph tool with the MCP server.
 * This is the only tool in Code Mode, providing access to all Constellation API capabilities
 * through JavaScript code execution.
 *
 * Supports multi-project workspaces via optional `cwd` parameter for dynamic config resolution.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ConfigurationError } from '../client/constellation-client.js';
import {
	createStructuredError,
	ValidationError,
} from '../client/error-factory.js';
import { CodeModeResponse, CodeModeRuntime } from '../code-mode/runtime.js';
import {
	configCache,
	ConfigCacheError,
	type ConfigContext,
} from '../config/config-cache.js';
import {
	DEFAULT_EXECUTION_TIMEOUT_MS,
	MAX_CODE_SIZE,
	MAX_EXECUTION_TIMEOUT_MS,
	MIN_EXECUTION_TIMEOUT_MS,
} from '../constants/index.js';

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
	asOfCommit?: string;
	lastIndexedAt?: string;
	resultContext?: {
		reason: string;
		branchIndexed: boolean;
		indexedFileCount: number;
	};
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

	if (response.asOfCommit) output.asOfCommit = response.asOfCommit;
	if (response.lastIndexedAt) output.lastIndexedAt = response.lastIndexedAt;
	if (response.resultContext) output.resultContext = response.resultContext;

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
 * Resolve configuration context for the given cwd.
 *
 * If cwd is provided, resolves config by finding the git root and loading
 * constellation.json. If cwd is not provided, uses the default config
 * from server startup (if available).
 *
 * @param cwd Optional working directory to resolve config from
 * @returns Configuration context
 * @throws Error if no config can be resolved
 */
async function resolveConfigContext(cwd?: string): Promise<ConfigContext> {
	if (cwd) {
		// Resolve config from provided cwd
		return configCache.getConfigForPath(cwd);
	}

	// Fall back to default config
	const defaultConfig = configCache.getDefaultConfig();
	if (!defaultConfig) {
		throw new ConfigCacheError(
			'No project context available. ' +
				'Provide the "cwd" parameter with your working directory to specify which project to query.',
			'NO_CONFIG',
			[
				'Provide cwd parameter with the path to your project',
				'Example: query_code_graph({ code: "...", cwd: "/path/to/project" })',
				'Run the MCP server from within a git repository with constellation.json',
			],
		);
	}

	return defaultConfig;
}

/**
 * Register the query_code_graph tool with the MCP server
 *
 * @param server - The McpServer instance to register the tool with
 */
export function registerQueryCodeGraphTool(server: McpServer): void {
	server.registerTool(
		'query_code_graph',
		{
			title: 'Query Code Intelligence',
			description:
				'DECISION RULE:\n' +
				'• query_code_graph: definitions, callers/callees, dependencies, dependents, impact analysis, dead code, architecture\n' +
				'• Grep: literal strings, log messages, config values, env vars\n' +
				'• Glob: find files by name/pattern\n' +
				'• Read: view source code content\n\n' +
				'Query codebase structure and relationships via AST-based code intelligence graph. ' +
				'Understands symbols, dependencies, call hierarchies, and change impact—capabilities text search lacks.\n\n' +
				'TOP 5 QUESTIONS:\n' +
				'• "Where is X defined?" / "Find function Y" → searchSymbols({query})\n' +
				'• "What calls X?" / "What imports this?" → getDependents({filePath}) or getCallGraph({symbolId})\n' +
				'• "What does X depend on?" → getDependencies({filePath})\n' +
				'• "Safe to modify X?" / "Blast radius?" → impactAnalysis({symbolId})\n' +
				'• "Find dead code" / "Unused exports?" → findOrphanedCode()\n\n' +
				'PROACTIVE SCENARIOS:\n' +
				'• About to modify a function/class — check impact first with impactAnalysis\n' +
				'• Exploring unfamiliar code — get architecture overview first\n' +
				'• Planning a refactor — trace dependencies and dependents\n\n' +
				'NOT FOR: literal string search, log messages, config values, or reading source code. Use Grep/Glob/Read for those.\n\n' +
				'QUICK START: const {symbols} = await api.searchSymbols({query: "AuthService"}); return symbols[0];\n\n' +
				'PERFORMANCE: Queries return in <200ms. One query_code_graph call replaces 3-5 Grep/Glob calls for structural questions—fewer round-trips, complete results.\n\n' +
				'Errors return structured JSON with `guidance[]` for recovery. Optionally run `api.getCapabilities()` to check indexing status.',
			inputSchema: {
				code: z
					.string()
					.min(1)
					.describe(
						'JavaScript code to execute. Can use top-level await. ' +
							'Available API methods: searchSymbols, getSymbolDetails, getDependencies, ' +
							'getDependents, findCircularDependencies, traceSymbolUsage, getCallGraph, ' +
							'impactAnalysis, findOrphanedCode, getArchitectureOverview',
					),
				timeout: z
					.number()
					.min(MIN_EXECUTION_TIMEOUT_MS)
					.max(MAX_EXECUTION_TIMEOUT_MS)
					.optional()
					.default(DEFAULT_EXECUTION_TIMEOUT_MS)
					.describe(
						`Maximum execution time in milliseconds (default: ${DEFAULT_EXECUTION_TIMEOUT_MS}, max: ${MAX_EXECUTION_TIMEOUT_MS})`,
					),
				cwd: z
					.string()
					.optional()
					.describe(
						'Working directory context for multi-project workspaces. ' +
							'Used to locate the correct constellation.json by finding the git repository root. ' +
							"If omitted, uses the server's startup directory. " +
							'Provide this when working in monorepos or workspaces with multiple indexed projects.',
					),
			},
			outputSchema: {
				success: z.boolean(),
				result: z.any().optional(),
				logs: z.array(z.string()).optional(),
				time: z.number().optional(),
				asOfCommit: z.string().optional(),
				lastIndexedAt: z.string().optional(),
				resultContext: z
					.object({
						reason: z.string(),
						branchIndexed: z.boolean(),
						indexedFileCount: z.number(),
					})
					.optional(),
				error: z.string().optional(),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ code, timeout, cwd }) => {
			console.error('[query_code_graph] Executing code mode script');
			if (cwd) {
				console.error(`[query_code_graph] Using cwd: ${cwd}`);
			}

			// Resolve configuration context
			let configContext: ConfigContext;
			try {
				configContext = await resolveConfigContext(cwd);
			} catch (error) {
				console.error('[query_code_graph] Config resolution failed:', error);

				// Create structured error for config resolution failures
				const structuredError = createStructuredError(
					error,
					'query_code_graph',
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

			try {
				// Check for configuration errors (e.g., missing constellation.json)
				if (configContext.initializationError) {
					console.error(
						'[query_code_graph] Configuration error detected, returning setup instructions',
					);

					// Create structured error for configuration issues
					const structuredError = createStructuredError(
						new ConfigurationError(configContext.initializationError),
						'query_code_graph',
						configContext,
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
						`[query_code_graph] Code too large: ${code.length} bytes (max ${MAX_CODE_SIZE})`,
					);
					const error = new ValidationError(
						`Code size (${code.length} bytes) exceeds maximum allowed (${MAX_CODE_SIZE} bytes / 100KB)`,
						{
							actualSize: code.length,
							maxSize: MAX_CODE_SIZE,
							guidance: [
								'Reduce code size by removing unnecessary code',
								'Break large operations into smaller steps',
								'Move data to API calls instead of embedding in code',
							],
						},
					);
					const structuredError = createStructuredError(
						error,
						'query_code_graph',
						configContext,
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

				// FIX SB-87: Check for binary/control characters
				if (BINARY_CHAR_PATTERN.test(code)) {
					console.error(
						'[query_code_graph] Code contains invalid binary characters',
					);
					const error = new ValidationError(
						'Code contains invalid binary or control characters',
						{
							reason: 'binary_chars_detected',
							guidance: [
								'Ensure code is valid UTF-8 text',
								'Remove any binary data or control characters',
								'Check for encoding issues in your code editor',
							],
						},
					);
					const structuredError = createStructuredError(
						error,
						'query_code_graph',
						configContext,
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

				// Create runtime with configuration
				const runtime = new CodeModeRuntime({
					timeout: timeout || DEFAULT_EXECUTION_TIMEOUT_MS,
					allowConsole: true,
					allowTimers: false,
					configContext,
				});

				// Execute the code
				const response = await runtime.execute({
					code,
					timeout,
				});

				// Check if response contains a structured error (from API/sandbox)
				if (response.structuredError) {
					console.error(
						'[query_code_graph] Execution returned structured error',
					);

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

				console.error('[query_code_graph] Execution successful');

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
				console.error('[query_code_graph] Execution error:', error);

				// Create structured error for unexpected errors
				const structuredError = createStructuredError(
					error,
					'query_code_graph',
					configContext,
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
		},
	);

	console.error('[query_code_graph] Tool registered successfully');
}
