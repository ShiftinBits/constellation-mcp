/**
 * Query Code Graph Tool Registration
 *
 * Registers the code_intel tool with the MCP server.
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
	DEFAULT_MAX_API_CALLS,
	DEFAULT_MEMORY_LIMIT_MB,
	MAX_CODE_SIZE,
	MAX_EXECUTION_TIMEOUT_MS,
	MIN_EXECUTION_TIMEOUT_MS,
} from '../constants/index.js';
import type { McpErrorResponse } from '../types/mcp-errors.js';
import {
	buildUsageEvent,
	isUsageTrackingEnabled,
	postUsageEvent,
	resolveUsageEndpointUrl,
} from '../utils/usage-tracker.js';

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
	timeoutBreakdown?: {
		baseMs: number;
		calls: Array<{ method: string; weight: number; computed?: true }>;
		parallelismFactor: number;
		estimatedMs: number;
		appliedMs: number;
		warnings: string[];
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
	if (response.timeoutBreakdown) {
		output.timeoutBreakdown = response.timeoutBreakdown;
	}

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
 * Transform an McpErrorResponse to SchemaCompliantOutput for error structuredContent.
 * Allows LLMs to access error state without parsing JSON from text content.
 *
 * Note: MCP SDK skips outputSchema validation when isError is true,
 * so this content passes through without validation. We conform to
 * SchemaCompliantOutput for consistency and forward compatibility.
 *
 * `timeoutBreakdown` is included when available: on the most
 * common error path — `EXECUTION_TIMEOUT` — the agent needs to see what
 * budget was attempted so it can scope down or override.
 */
function toErrorStructuredContent(
	errorResponse: McpErrorResponse,
	timeoutBreakdown?: SchemaCompliantOutput['timeoutBreakdown'],
): SchemaCompliantOutput {
	return {
		success: false,
		error: errorResponse.error.message,
		...(timeoutBreakdown ? { timeoutBreakdown } : {}),
	};
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

	// Safety fallback — cwd is required by schema, but defend in depth
	const defaultConfig = configCache.getDefaultConfig();
	if (!defaultConfig) {
		throw new ConfigCacheError(
			'No project context available. The required `cwd` parameter was not provided.',
			'NO_CONFIG',
			[
				'The cwd parameter is required — provide the absolute path to the target project directory',
				'Example: code_intel({ code: "...", cwd: "/absolute/path/to/project" })',
				'The project directory must be inside a git repository containing constellation.json',
			],
		);
	}

	return defaultConfig;
}

/**
 * Register the code_intel tool with the MCP server
 *
 * @param server - The McpServer instance to register the tool with
 */
export function registerQueryCodeGraphTool(server: McpServer): void {
	server.registerTool(
		'code_intel',
		{
			title: 'Code Intelligence',
			description:
				'DECISION RULE: Structure questions → this tool. Text search → Grep.\n\n' +
				'Before using Grep, ask: Is this a STRUCTURE question (definitions, callers, impact) or a TEXT question (strings, config)?\n\n' +
				'QUICK START: `return await api.searchSymbols({query: "AuthService"})` — simple queries are one-liners.\n' +
				'Run `api.listMethods()` for full API reference with signatures and descriptions.\n' +
				'Run `api.help("methodName")` for inline TypeScript type definitions — no resource reads needed.\n' +
				'Compose: `const [impact, deps] = await Promise.all([api.impactAnalysis({symbolId}), api.getDependents({filePath})]);`\n\n' +
				'WHY THIS TOOL: Graph-backed intelligence finds indirect relationships, transitive dependencies, and breaking change risks that text search cannot detect.\n\n' +
				'"What uses X?" disambiguation: getDependents (file imports) vs getCallGraph (call chain) vs traceSymbolUsage (all usages).\n\n' +
				'USE IMMEDIATELY WHEN:\n' +
				'• BEFORE using Edit on a function/class → run impactAnalysis({symbolId}) first\n' +
				'• BEFORE exploring an unfamiliar codebase → run getArchitectureOverview()\n' +
				'• BEFORE refactoring → trace getDependencies + getDependents for blast radius\n' +
				'• Running 3+ Grep calls for structure? STOP → use code_intel instead\n\n' +
				'TOP 5 QUESTIONS (query is case-insensitive substring match):\n' +
				'• "Where is X defined?" / "Find function Y" → searchSymbols({query})\n' +
				'• "What calls X?" / "What imports this?" → getDependents({filePath}) or getCallGraph({symbolId})\n' +
				'• "What does X depend on?" → getDependencies({filePath})\n' +
				'• "Safe to modify X?" / "Blast radius?" → impactAnalysis({symbolId})\n' +
				'• "Find dead code" / "Unused exports?" → findOrphanedCode()\n' +
				'• "Complex functions?" / "Refactoring targets?" → searchSymbols results include complexity.cyclomaticComplexity + complexityRisk per function\n\n' +
				'NOT FOR: literal string search, log messages, config values, or reading source code. Use Grep/Glob/Read for those.\n' +
				'Supports TypeScript, JavaScript, Python, and more — run api.getCapabilities() to check your project.\n' +
				"File-path-scoped methods (getDependencies, getDependents, getCallGraph, traceSymbolUsage, impactAnalysis) reject calls whose `filePath` extension is not in the project's configured languages with `UNSUPPORTED_LANGUAGE` — check api.getCapabilities() first.\n\n" +
				"WRONG TOOL SIGNAL: If you've run 3+ Grep calls for structure (callers, dependencies, impact), STOP and use code_intel instead.\n" +
				'Typical workflow: code_intel to find (results include source snippets) → Edit to modify\n\n' +
				`Sandbox limits: ${DEFAULT_MAX_API_CALLS} api.* calls per execution, ${DEFAULT_MEMORY_LIMIT_MB} MB memory, ${MAX_CODE_SIZE / 1024} KB max code size, \`limit\` max 100 on any method with a \`limit\` param. Pure JS only — no require/import/fs/net/process (see constellation://docs/guide for full restrictions).\n\n` +
				'IMPORTANT: The `cwd` parameter is required — always set it to the target project directory path.',
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
					.describe(
						`Optional execution-time override in milliseconds. When omitted, the sandbox derives the timeout from the static complexity of your code (heavier api.* methods raise the budget) and clamps the result to [${MIN_EXECUTION_TIMEOUT_MS}, ${MAX_EXECUTION_TIMEOUT_MS}]. The breakdown is returned in the response so you can see what was applied. Explicit values still win and are clamped to the same range.`,
					),
				cwd: z
					.string()
					.min(1)
					.describe(
						'Absolute path to the project directory being queried. ' +
							'Used to locate the correct constellation.json by finding the git repository root. ' +
							'Set this to the root of the repository or workspace folder you are working in.',
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
				timeoutBreakdown: z
					.object({
						baseMs: z.number(),
						calls: z.array(
							z.object({
								method: z.string(),
								weight: z.number(),
								computed: z.literal(true).optional(),
							}),
						),
						parallelismFactor: z.number(),
						estimatedMs: z.number(),
						appliedMs: z.number(),
						warnings: z.array(z.string()),
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
			console.error('[code_intel] Executing code mode script');
			if (cwd) {
				console.error(`[code_intel] Using cwd: ${cwd}`);
			}

			// Resolve configuration context
			let configContext: ConfigContext;
			try {
				configContext = await resolveConfigContext(cwd);
			} catch (error) {
				console.error('[code_intel] Config resolution failed:', error);

				// Create structured error for config resolution failures
				const structuredError = createStructuredError(error, 'code_intel');

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(structuredError, null, 2),
						},
					],
					structuredContent: toErrorStructuredContent(structuredError),
					isError: true,
				};
			}

			// Hoisted so the outer catch can surface the estimator's
			// timeoutBreakdown if execution threw AFTER the estimator ran
			//. Without this, an unexpected throw would discard the
			// computed budget that the agent needs for self-correction.
			let response: CodeModeResponse | undefined;

			try {
				// Check for configuration errors (e.g., missing constellation.json)
				if (configContext.initializationError) {
					console.error(
						'[code_intel] Configuration error detected, returning setup instructions',
					);

					// Create structured error for configuration issues
					const structuredError = createStructuredError(
						new ConfigurationError(configContext.initializationError),
						'code_intel',
						configContext,
					);

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(structuredError, null, 2),
							},
						],
						structuredContent: toErrorStructuredContent(structuredError),
						isError: true,
					};
				}

				// FIX SB-87: Validate code size to prevent DoS attacks
				if (code.length > MAX_CODE_SIZE) {
					console.error(
						`[code_intel] Code too large: ${code.length} bytes (max ${MAX_CODE_SIZE})`,
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
						'code_intel',
						configContext,
					);
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(structuredError, null, 2),
							},
						],
						structuredContent: toErrorStructuredContent(structuredError),
						isError: true,
					};
				}

				// FIX SB-87: Check for binary/control characters
				if (BINARY_CHAR_PATTERN.test(code)) {
					console.error('[code_intel] Code contains invalid binary characters');
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
						'code_intel',
						configContext,
					);
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(structuredError, null, 2),
							},
						],
						structuredContent: toErrorStructuredContent(structuredError),
						isError: true,
					};
				}

				// Create runtime with configuration. The constructor `timeout`
				// is only a fallback used by sandbox internals when no
				// per-call override is supplied (e.g. when the AST cannot
				// be parsed). The real per-execution timeout is derived by
				// the estimator inside runtime.execute().
				const runtime = new CodeModeRuntime({
					timeout: timeout ?? DEFAULT_EXECUTION_TIMEOUT_MS,
					allowConsole: true,
					allowTimers: false,
					configContext,
				});

				// Execute the code — passing `timeout` verbatim (may be
				// undefined) so the estimator can distinguish "no override"
				// from an explicit value. Assignment uses the hoisted
				// `response` so the outer catch can read timeoutBreakdown
				// after an unexpected throw.
				response = await runtime.execute({
					code,
					timeout,
				});

				// Check if response contains a structured error (from API/sandbox)
				if (response.structuredError) {
					console.error('[code_intel] Execution returned structured error');

					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify(response.structuredError, null, 2),
							},
						],
						// surface the timeout breakdown on error paths too —
						// most agent-facing errors here are EXECUTION_TIMEOUT, where
						// the breakdown is the actionable diagnostic.
						structuredContent: toErrorStructuredContent(
							response.structuredError,
							response.timeoutBreakdown,
						),
						isError: true,
					};
				}

				// Format the result for successful execution
				const formatted = runtime.formatResult(response);

				console.error('[code_intel] Execution successful');

				// Fire-and-forget usage telemetry on successful calls only.
				// Gated on USAGE_TRACKING_ENABLED=true (default off) AND
				// response.success. A degraded result that propagates a
				// failure without a structuredError would otherwise reach
				// here with partial invocations — explicitly gating on
				// `response.success` keeps telemetry scoped to the happy
				// path even if the upstream branch shape evolves.
				// Failures inside postUsageEvent are swallowed and never
				// block the LLM response.
				if (
					isUsageTrackingEnabled() &&
					response.success &&
					response.invocations &&
					response.invocations.length > 0
				) {
					try {
						const payload = buildUsageEvent({
							projectId: configContext.projectId,
							branchName: configContext.branchName,
							invocations: response.invocations,
							invocationActualTokens: response.invocationActualTokens ?? [],
							durationMs: response.executionTime ?? 0,
							timeoutBreakdown: response.timeoutBreakdown,
						});
						if (payload !== null) {
							postUsageEvent({
								endpointUrl: resolveUsageEndpointUrl(
									configContext.config.apiUrl,
								),
								accessKey: configContext.apiKey,
								payload,
							});
						}
					} catch (err) {
						if (process.env.DEBUG) {
							const msg = err instanceof Error ? err.message : String(err);
							console.error(
								`[code_intel] usage telemetry build failed: ${msg} (ignored)`,
							);
						}
					}
				}

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
				console.error('[code_intel] Execution error:', error);

				// Create structured error for unexpected errors
				const structuredError = createStructuredError(
					error,
					'code_intel',
					configContext,
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(structuredError, null, 2),
						},
					],
					// if execution threw AFTER the estimator ran,
					// the breakdown is available via the hoisted `response`
					// and is the actionable signal for the agent.
					structuredContent: toErrorStructuredContent(
						structuredError,
						response?.timeoutBreakdown,
					),
					isError: true,
				};
			}
		},
	);

	console.error('[code_intel] Tool registered successfully');
}
