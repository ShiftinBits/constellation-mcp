/**
 * Code Mode Sandbox
 *
 * Provides an isolated execution environment for user-generated JavaScript code
 * with access to the Constellation API.
 *
 * ## Security Model
 *
 * This sandbox provides **convenience isolation** to prevent accidental damage:
 * - Timeout enforcement prevents infinite loops
 * - Memory limits prevent exhaustion
 * - Pattern validation blocks common dangerous patterns
 * - Isolated built-ins prevent prototype pollution
 *
 * **WARNING**: This is NOT a security boundary against malicious code. The Node.js
 * vm module has known limitations. For production deployments, run in a container
 * or VM with appropriate OS-level isolation.
 *
 * See docs/code-mode/SANDBOX-SECURITY.md for full threat model and deployment recommendations.
 */

import vm from 'vm';
import { ConstellationClient } from '../client/constellation-client.js';
import type { ConfigContext } from '../config/config-cache.js';
import { createStructuredError } from '../client/error-factory.js';
import type { McpErrorResponse } from '../types/mcp-errors.js';
import type { McpToolResult } from '../types/mcp-response.js';
import {
	getProjectCapabilities,
	type ProjectCapabilities,
} from './capabilities.js';
import { addAutoReturn } from './auto-return.js';
import { validateAst } from './validators/index.js';
import {
	DEFAULT_EXECUTION_TIMEOUT_MS,
	DEFAULT_MEMORY_LIMIT_MB,
	DEFAULT_MAX_API_CALLS,
	PARAM_SUMMARY_MAX_LENGTH,
	MAX_CONSOLE_OBJECT_SIZE,
	MEMORY_CHECK_INTERVAL_MS,
} from '../constants/index.js';
import { AuditLogger } from '../utils/audit-logger.js';
import { Metrics } from '../utils/metrics.js';
import { METHOD_SUMMARIES } from '../types/method-summaries.js';
import { enrichWithSourceSnippets } from './source-enrichment.js';

// Import API types from shared package - single source of truth
import type {
	SearchSymbolsParams,
	SearchSymbolsResult,
	GetSymbolDetailsParams,
	SymbolDetailsResult,
	GetDependenciesParams,
	GetDependenciesResult,
	GetDependentsParams,
	GetDependentsResult,
	FindCircularDependenciesParams,
	FindCircularDependenciesResult,
	TraceSymbolUsageParams,
	TraceSymbolUsageResult,
	GetCallGraphParams,
	GetCallGraphResult,
	FindOrphanedCodeParams,
	FindOrphanedCodeResult,
	ImpactAnalysisParams,
	ImpactAnalysisResult,
	GetArchitectureOverviewParams,
	GetArchitectureOverviewResult,
	PingResult,
} from '@constellationdev/types';

/**
 * Error thrown when memory limit is exceeded during sandbox execution.
 * This is a best-effort detection - rapid allocation may bypass the check interval.
 */
export class MemoryExceededError extends Error {
	constructor(
		public readonly usedMB: number,
		public readonly limitMB: number,
	) {
		super(
			`Memory limit exceeded: ${usedMB.toFixed(1)}MB used, limit is ${limitMB}MB`,
		);
		this.name = 'MemoryExceededError';
	}
}

/**
 * Method metadata for listMethods() response.
 * Provides discoverability information for AI assistants.
 */
export interface MethodInfo {
	/** Method name (e.g., "searchSymbols") */
	name: string;
	/** Human-readable description of what the method does */
	description: string;
	/** User intent phrases that map to this method */
	triggerPhrases: string[];
	/** Example code snippet showing typical usage */
	quickExample: string;
	/** URI to read this method's type definitions */
	typesResourceUri: string;
}

/**
 * Composition pattern for listMethods() response.
 * Provides recipes for combining API methods effectively.
 */
export interface CompositionPattern {
	/** Pattern name (e.g., "Sequential Chain") */
	name: string;
	/** Description of what this pattern achieves */
	description: string;
	/** Example code demonstrating the pattern */
	code: string;
}

/**
 * Response from api.listMethods()
 */
export interface ListMethodsResult {
	methods: MethodInfo[];
	usage: string;
	example: string;
	decisionGuide?: Record<string, string>;
	compositionPatterns?: CompositionPattern[];
	tip: string;
	reference: string;
}

/**
 * Typed interface for the Constellation API exposed in Code Mode sandbox.
 *
 * This interface ensures type safety between the sandbox implementation
 * and the documented API types in api-types.d.ts.
 */
export interface ConstellationApi {
	// Discovery methods
	searchSymbols(params: SearchSymbolsParams): Promise<SearchSymbolsResult>;
	getSymbolDetails(
		params: GetSymbolDetailsParams,
	): Promise<SymbolDetailsResult>;

	// Dependency analysis
	getDependencies(
		params: GetDependenciesParams,
	): Promise<GetDependenciesResult>;
	getDependents(params: GetDependentsParams): Promise<GetDependentsResult>;
	findCircularDependencies(
		params: FindCircularDependenciesParams,
	): Promise<FindCircularDependenciesResult>;

	// Usage analysis
	traceSymbolUsage(
		params: TraceSymbolUsageParams,
	): Promise<TraceSymbolUsageResult>;
	getCallGraph(params: GetCallGraphParams): Promise<GetCallGraphResult>;

	// Impact and quality
	impactAnalysis(params: ImpactAnalysisParams): Promise<ImpactAnalysisResult>;
	findOrphanedCode(
		params: FindOrphanedCodeParams,
	): Promise<FindOrphanedCodeResult>;

	// Architecture
	getArchitectureOverview(
		params?: GetArchitectureOverviewParams,
	): Promise<GetArchitectureOverviewResult>;

	// Utility
	ping(): Promise<PingResult>;
	listMethods(params?: { query?: string }): ListMethodsResult;
	help(methodName?: string): string;
	getCapabilities(): Promise<ProjectCapabilities>;
}

/**
 * Configuration options for the Code Mode sandbox execution environment.
 *
 * @example
 * ```typescript
 * const sandbox = new CodeModeSandbox({
 *   timeout: 60000,      // 60 second timeout
 *   allowConsole: true,  // Enable console.log
 *   maxApiCalls: 100,    // Higher limit for complex operations
 *   configContext,       // Required: configuration context
 * });
 * ```
 */
export interface SandboxOptions {
	/**
	 * Configuration context for this execution.
	 * Required - provides API credentials and project context.
	 */
	configContext: ConfigContext;

	/**
	 * Maximum execution time in milliseconds.
	 * @default 30000 (30 seconds)
	 */
	timeout?: number;

	/**
	 * Memory limit in MB for sandbox execution.
	 * Enforced via periodic heap checking (best-effort - rapid allocation may exceed
	 * the limit between checks). For hard limits, use container memory limits.
	 * @default 128
	 */
	memoryLimit?: number;

	/**
	 * Whether to allow console methods (log, warn, error, info).
	 * Logs are captured and returned in SandboxResult.logs.
	 * @default true
	 */
	allowConsole?: boolean;

	/**
	 * Whether to allow timer functions (setTimeout, setInterval).
	 * Generally disabled for security.
	 * @default false
	 */
	allowTimers?: boolean;

	/**
	 * Maximum number of API calls allowed per execution.
	 * Prevents DoS via excessive API requests.
	 * @default 50
	 */
	maxApiCalls?: number;

	/**
	 * Project context for API calls.
	 * Defaults to values from configContext.
	 */
	projectContext?: {
		projectId: string;
		branchName: string;
	};
}

/**
 * Result of sandbox code execution.
 *
 * @example
 * ```typescript
 * const result = await sandbox.execute(code);
 * if (result.success) {
 *   console.log('Result:', result.result);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export interface SandboxResult {
	/** Whether execution completed without errors */
	success: boolean;
	/** Return value of executed code (if successful) */
	result?: any;
	/** Error message (if execution failed) */
	error?: string;
	/** Structured error for programmatic handling */
	structuredError?: McpErrorResponse;
	/** Console output captured during execution */
	logs?: string[];
	/** Execution time in milliseconds */
	executionTime: number;
	/** Git commit hash of the latest indexed data (from API responses) */
	asOfCommit?: string;
	/** ISO timestamp of the most recently indexed file (from API responses) */
	lastIndexedAt?: string;
	/** Disambiguation context for empty results (from API responses) */
	resultContext?: {
		reason: string;
		branchIndexed: boolean;
		indexedFileCount: number;
	};
}

/**
 * Code Mode Sandbox for secure code execution
 */
export class CodeModeSandbox {
	private options: Required<Omit<SandboxOptions, 'configContext'>> & {
		projectContext: { projectId: string; branchName: string };
	};
	private client: ConstellationClient;
	private configContext: ConfigContext;

	constructor(options: SandboxOptions) {
		const { configContext } = options;
		this.configContext = configContext;

		// Validate config is properly initialized before proceeding
		if (!configContext.config || !configContext.apiKey) {
			throw new Error(
				'Configuration not initialized. Ensure CONSTELLATION_ACCESS_KEY and CONSTELLATION_API_URL are set.',
			);
		}

		this.options = {
			timeout: options.timeout || DEFAULT_EXECUTION_TIMEOUT_MS,
			memoryLimit: options.memoryLimit || DEFAULT_MEMORY_LIMIT_MB,
			allowConsole: options.allowConsole !== false,
			allowTimers: options.allowTimers || false,
			maxApiCalls: options.maxApiCalls || DEFAULT_MAX_API_CALLS,
			projectContext: options.projectContext || {
				projectId: configContext.projectId,
				branchName: configContext.branchName,
			},
		};

		// Initialize constellation client with provided config
		this.client = new ConstellationClient(
			configContext.config,
			configContext.apiKey,
		);
	}

	/**
	 * Execute JavaScript code in sandboxed environment
	 */
	async execute(code: string): Promise<SandboxResult> {
		const startTime = Date.now();
		const logs: string[] = [];

		// Track execution metrics and audit trail (SB-258 Steps 3.4, 3.5)
		Metrics.get().increment('executions');
		AuditLogger.get().log({
			timestamp: new Date().toISOString(),
			event: 'execution_start',
			code: code.slice(0, 500),
		});

		// Self-protective validation (defense in depth)
		// Even if validation happens externally (runtime.ts), we validate here too
		// to protect against direct instantiation bypassing external checks
		const validation = this.validateCode(code);
		if (!validation.valid) {
			Metrics.get().increment('validation_failures');
			AuditLogger.get().log({
				timestamp: new Date().toISOString(),
				event: 'validation_failure',
				code: code.slice(0, 500),
			});
			return {
				success: false,
				error: `Security validation failed: ${validation.errors?.join(', ')}`,
				logs: validation.warnings?.map((w) => `[WARN] ${w}`) || [],
				executionTime: Date.now() - startTime,
			};
		}
		// Include warnings in logs if validation passed
		if (validation.warnings) {
			logs.push(...validation.warnings.map((w) => `[WARN] ${w}`));
		}

		// Declare handles outside try block for cleanup
		const timeoutMs = this.options.timeout;
		let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
		let memoryCheckHandle: ReturnType<typeof setInterval> | undefined;
		// Guard flag to prevent double rejection (covers timeout and memory exceeded)
		let hasTerminated = false;

		// Shared mutable state for capturing data from sandbox execution
		const executionState = {
			asOfCommit: null as string | null,
			lastIndexedAt: null as string | null,
			resultContext: null as {
				reason: string;
				branchIndexed: boolean;
				indexedFileCount: number;
			} | null,
			timerCleanup: null as (() => void) | null,
		};

		try {
			// Create sandbox context with API bindings
			const sandbox = this.createSandboxContext(logs, executionState);

			// Wrap code in async IIFE if not already
			const wrappedCode = this.wrapCode(code);

			// Create and run script in sandbox
			const script = new vm.Script(wrappedCode, {
				filename: 'code-mode-script.js',
			});

			const context = vm.createContext(sandbox);

			// Freeze prototypes in the sandbox to prevent prototype pollution attacks (SB-102)
			this.freezeSandboxPrototypes(context);

			// FIX SB-85: VM timeout only applies to synchronous execution.
			// Async code (including our async IIFE wrapper) returns a Promise immediately,
			// which means infinite async loops would bypass the timeout.
			// Use Promise.race() to enforce timeout on the entire async execution.
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => {
					// Only reject if not already handled (prevents double rejection)
					if (!hasTerminated) {
						hasTerminated = true;
						reject(new Error('Script execution timed out'));
					}
				}, timeoutMs);
			});

			// Memory limit enforcement - best-effort periodic checking (SB-156)
			const memoryLimitBytes = this.options.memoryLimit * 1024 * 1024;
			const memoryCheckPromise = new Promise<never>((_, reject) => {
				memoryCheckHandle = setInterval(() => {
					const heapUsed = process.memoryUsage().heapUsed;
					if (heapUsed > memoryLimitBytes && !hasTerminated) {
						hasTerminated = true;
						const usedMB = heapUsed / (1024 * 1024);
						reject(new MemoryExceededError(usedMB, this.options.memoryLimit));
					}
				}, MEMORY_CHECK_INTERVAL_MS);
			});

			// Run script with VM timeout (catches sync hangs) and race with timeout Promise (catches async hangs)
			// Note: breakOnSigint uses POSIX signals which don't work on Windows
			const scriptResult = script.runInContext(context, {
				timeout: timeoutMs,
				breakOnSigint: process.platform !== 'win32',
			});

			// Race script against timeout AND memory check
			const result = await Promise.race([
				Promise.resolve(scriptResult),
				timeoutPromise,
				memoryCheckPromise,
			]);

			const executionTime = Date.now() - startTime;
			Metrics.get().recordDuration('execution_duration', executionTime);
			AuditLogger.get().log({
				timestamp: new Date().toISOString(),
				event: 'execution_end',
				success: true,
				duration: executionTime,
			});

			return {
				success: true,
				result,
				logs,
				executionTime,
				asOfCommit: executionState.asOfCommit ?? undefined,
				lastIndexedAt: executionState.lastIndexedAt ?? undefined,
				resultContext: executionState.resultContext ?? undefined,
			};
		} catch (error) {
			// Mark as handled to prevent any pending timeout/memory callbacks from firing
			hasTerminated = true;

			const executionTime = Date.now() - startTime;
			Metrics.get().increment('errors');
			Metrics.get().recordDuration('execution_duration', executionTime);
			AuditLogger.get().log({
				timestamp: new Date().toISOString(),
				event: 'error',
				error: error instanceof Error ? error.message : String(error),
				duration: executionTime,
			});

			// Create structured error to preserve error type information
			// Pass configContext for accurate project/branch info in multi-project scenarios
			const structuredError = createStructuredError(
				error,
				'execute',
				this.configContext,
			);

			return {
				success: false,
				error: this.formatError(error),
				structuredError,
				logs,
				executionTime,
			};
		} finally {
			// Mark as handled to prevent any pending timeout/memory callbacks from firing
			hasTerminated = true;

			// Clean up timeout in ALL paths (success, VM timeout error, or other errors)
			// This prevents unhandled promise rejections when VM's internal timeout fires
			// before the Promise-based timeout, leaving the setTimeout dangling
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			// Clean up memory check interval (SB-156)
			if (memoryCheckHandle) {
				clearInterval(memoryCheckHandle);
			}
			// Clean up sandbox timers to prevent callbacks from outliving execution (SB-258)
			executionState.timerCleanup?.();
		}
	}

	/**
	 * Freeze built-in prototypes in the sandbox context to prevent prototype pollution.
	 * Must be called AFTER vm.createContext() since that creates isolated copies.
	 *
	 * Security note: vm.createContext() creates isolated prototype copies, so freezing
	 * them only affects the sandbox and doesn't impact the host environment.
	 */
	private freezeSandboxPrototypes(context: vm.Context): void {
		vm.runInContext(
			`
			// Freeze all built-in prototypes to prevent prototype pollution
			Object.freeze(Object.prototype);
			Object.freeze(Array.prototype);
			Object.freeze(String.prototype);
			Object.freeze(Number.prototype);
			Object.freeze(Boolean.prototype);
			Object.freeze(Date.prototype);
			Object.freeze(RegExp.prototype);
			Object.freeze(Map.prototype);
			Object.freeze(Set.prototype);
			Object.freeze(Promise.prototype);
			Object.freeze(Function.prototype);

			// Freeze constructors to prevent modification of static methods
			Object.freeze(Object);
			Object.freeze(Array);
			Object.freeze(String);
			Object.freeze(Number);
			Object.freeze(Boolean);
			Object.freeze(Date);
			Object.freeze(RegExp);
			Object.freeze(Map);
			Object.freeze(Set);
			Object.freeze(Promise);
			Object.freeze(Function);

			// Freeze utility objects
			Object.freeze(JSON);
			Object.freeze(Math);

			// Make global constructor bindings non-writable to prevent reassignment
			// This prevents attacks like: Array = function() { return 'hacked'; }
			const constructorNames = [
				'Object', 'Array', 'String', 'Number', 'Boolean',
				'Date', 'RegExp', 'Map', 'Set', 'Promise', 'Function',
				'JSON', 'Math'
			];
			for (const name of constructorNames) {
				Object.defineProperty(this, name, {
					writable: false,
					configurable: false
				});
			}
		`,
			context,
		);
	}

	/**
	 * Create sandbox context with API and utilities
	 */
	private createSandboxContext(
		logs: string[],
		executionState: {
			asOfCommit: string | null;
			lastIndexedAt: string | null;
			resultContext: {
				reason: string;
				branchIndexed: boolean;
				indexedFileCount: number;
			} | null;
			timerCleanup: (() => void) | null;
		},
	): any {
		// Helper to convert snake_case to camelCase for display
		const snakeToCamel = (str: string): string => {
			return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
		};

		// Helper to summarize params for error display (truncate large objects)
		const summarizeParams = (params: any): string => {
			try {
				const json = JSON.stringify(params);
				if (json.length > PARAM_SUMMARY_MAX_LENGTH) {
					return json.substring(0, PARAM_SUMMARY_MAX_LENGTH - 3) + '...';
				}
				return json;
			} catch {
				return '[unable to serialize]';
			}
		};

		// FIX: Rate limiting counter to prevent DoS via excessive API calls
		let apiCallCount = 0;
		const maxApiCalls = this.options.maxApiCalls;

		// Create API executor that calls through to our client with enhanced error context
		const executor = async (toolName: string, params: any) => {
			// FIX: Check rate limit before making API call
			apiCallCount++;
			if (apiCallCount > maxApiCalls) {
				throw new Error(
					`API call limit exceeded: maximum ${maxApiCalls} calls per execution. ` +
						`Consider batching operations or using more specific queries.`,
				);
			}

			Metrics.get().increment('api_calls');
			const startTime = Date.now();

			try {
				const result = await this.client.executeMcpTool(
					toolName,
					params,
					this.options.projectContext,
				);

				if (!result.success) {
					const duration = Date.now() - startTime;
					const paramsPreview = summarizeParams(params);
					AuditLogger.get().log({
						timestamp: new Date().toISOString(),
						event: 'api_call',
						method: snakeToCamel(toolName),
						duration,
						success: false,
						error: result.error || 'Unknown error',
					});
					throw new Error(
						`API call failed: api.${snakeToCamel(toolName)}()\n` +
							`  Parameters: ${paramsPreview}\n` +
							`  Duration: ${duration}ms\n` +
							`  Error: ${result.error || 'Unknown error'}`,
					);
				}

				const duration = Date.now() - startTime;
				AuditLogger.get().log({
					timestamp: new Date().toISOString(),
					event: 'api_call',
					method: snakeToCamel(toolName),
					duration,
					success: true,
				});

				// Track index metadata from API response
				if (result.metadata?.asOfCommit) {
					executionState.asOfCommit = result.metadata.asOfCommit;
				}
				if (result.metadata?.lastIndexedAt) {
					executionState.lastIndexedAt = result.metadata.lastIndexedAt;
				}
				if (result.metadata?.resultContext) {
					executionState.resultContext = result.metadata
						.resultContext as typeof executionState.resultContext;
				}

				// Enrich response with source snippets from local files (best-effort)
				try {
					await enrichWithSourceSnippets(
						result.data,
						this.configContext.gitRoot,
					);
				} catch {
					// Enrichment is best-effort; return un-enriched data on failure
				}

				return result.data;
			} catch (error) {
				// Re-throw if already formatted
				if (
					error instanceof Error &&
					error.message.startsWith('API call failed:')
				) {
					throw error;
				}

				const duration = Date.now() - startTime;
				const paramsPreview = summarizeParams(params);
				AuditLogger.get().log({
					timestamp: new Date().toISOString(),
					event: 'api_call',
					method: snakeToCamel(toolName),
					duration,
					success: false,
					error: error instanceof Error ? error.message : String(error),
				});
				throw new Error(
					`API call failed: api.${snakeToCamel(toolName)}()\n` +
						`  Parameters: ${paramsPreview}\n` +
						`  Duration: ${duration}ms\n` +
						`  Error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		};

		// Available API methods for listMethods() with enhanced metadata
		const availableMethods: MethodInfo[] = [
			{
				name: 'searchSymbols',
				description: 'Search for symbols by name/pattern',
				triggerPhrases: ['find function', 'find class', 'where is', 'locate'],
				quickExample: `await api.searchSymbols({ query: "User", limit: 10 })`,
				typesResourceUri: 'constellation://types/api/searchSymbols',
			},
			{
				name: 'getSymbolDetails',
				description: 'Get detailed info about a symbol',
				triggerPhrases: ['symbol details', 'more info about'],
				quickExample: `await api.getSymbolDetails({ symbolId: "..." })`,
				typesResourceUri: 'constellation://types/api/getSymbolDetails',
			},
			{
				name: 'getDependencies',
				description: 'Get what a file depends on',
				triggerPhrases: ['what imports', 'dependencies of', 'what does it use'],
				quickExample: `await api.getDependencies({ filePath: "src/index.ts" })`,
				typesResourceUri: 'constellation://types/api/getDependencies',
			},
			{
				name: 'getDependents',
				description: 'Get what depends on a file',
				triggerPhrases: ['what uses this', 'who imports', 'dependents of'],
				quickExample: `await api.getDependents({ filePath: "src/utils.ts" })`,
				typesResourceUri: 'constellation://types/api/getDependents',
			},
			{
				name: 'findCircularDependencies',
				description: 'Find circular dependency cycles',
				triggerPhrases: [
					'circular dependency',
					'import cycle',
					'dependency loop',
				],
				quickExample: `await api.findCircularDependencies({ maxCycleLength: 10 })`,
				typesResourceUri: 'constellation://types/api/findCircularDependencies',
			},
			{
				name: 'traceSymbolUsage',
				description: 'Find all usages of a symbol',
				triggerPhrases: ['where is used', 'find usages', 'trace usage'],
				quickExample: `await api.traceSymbolUsage({ symbolName: "User", filePath: "..." })`,
				typesResourceUri: 'constellation://types/api/traceSymbolUsage',
			},
			{
				name: 'getCallGraph',
				description: 'Get function call relationships',
				triggerPhrases: ['what calls', 'called by', 'call graph'],
				quickExample: `await api.getCallGraph({ symbolName: "process", filePath: "..." })`,
				typesResourceUri: 'constellation://types/api/getCallGraph',
			},
			{
				name: 'findOrphanedCode',
				description: 'Find unused/dead code',
				triggerPhrases: ['unused code', 'dead code', 'orphaned', 'can delete'],
				quickExample: `await api.findOrphanedCode({ limit: 20 })`,
				typesResourceUri: 'constellation://types/api/findOrphanedCode',
			},
			{
				name: 'impactAnalysis',
				description: 'Analyze change impact',
				triggerPhrases: [
					'what breaks if',
					'safe to change',
					'impact of',
					'blast radius',
				],
				quickExample: `await api.impactAnalysis({ symbolId: "..." })`,
				typesResourceUri: 'constellation://types/api/impactAnalysis',
			},
			{
				name: 'getArchitectureOverview',
				description: 'Get high-level project structure',
				triggerPhrases: [
					'project structure',
					'architecture',
					'codebase overview',
				],
				quickExample: `await api.getArchitectureOverview({ includeMetrics: true })`,
				typesResourceUri: 'constellation://types/api/getArchitectureOverview',
			},
			{
				name: 'ping',
				description:
					'Check authentication, configuration, and API connectivity',
				triggerPhrases: [
					'ping',
					'check connection',
					'test auth',
					'verify access',
				],
				quickExample: `await api.ping()`,
				typesResourceUri: 'constellation://types/api/ping',
			},
			{
				name: 'getCapabilities',
				description: 'Check project indexing status and available features',
				triggerPhrases: ['is indexed', 'project status', 'capabilities'],
				quickExample: `await api.getCapabilities()`,
				typesResourceUri: 'constellation://types/api/getCapabilities',
			},
			{
				name: 'listMethods',
				description:
					'List all available API methods with descriptions and examples (sync)',
				triggerPhrases: ['what methods', 'available methods', 'api reference'],
				quickExample: `api.listMethods()  // or: api.listMethods({ query: "impact" })`,
				typesResourceUri: 'constellation://docs/guide/methods',
			},
			{
				name: 'help',
				description:
					'Get TypeScript type definitions for a specific method (sync, same content as constellation://types/api/{method})',
				triggerPhrases: [
					'method types',
					'parameter types',
					'what does it return',
				],
				quickExample: `api.help("searchSymbols")  // Returns TypeScript interface`,
				typesResourceUri: 'constellation://docs/guide/methods',
			},
		];

		// Decision guide mapping user intent to API method
		const decisionGuide: Record<string, string> = {
			'find symbol': 'searchSymbols',
			'locate function': 'searchSymbols',
			'where is defined': 'searchSymbols',
			'what imports': 'getDependencies',
			'dependencies of': 'getDependencies',
			'what uses': 'getDependents',
			'who imports': 'getDependents',
			'is it safe to change': 'impactAnalysis',
			'what breaks': 'impactAnalysis',
			'blast radius': 'impactAnalysis',
			'unused code': 'findOrphanedCode',
			'dead code': 'findOrphanedCode',
			'circular dependency': 'findCircularDependencies',
			'import cycle': 'findCircularDependencies',
			'call graph': 'getCallGraph',
			'what calls': 'getCallGraph',
			'project structure': 'getArchitectureOverview',
			architecture: 'getArchitectureOverview',
			'test connection': 'ping',
			'check auth': 'ping',
			'verify access': 'ping',
		};

		// Composition patterns for teaching LLMs how to combine API methods
		const compositionPatterns: CompositionPattern[] = [
			{
				name: 'Sequential Chain',
				description: 'Find a symbol, get details, then analyze impact',
				code: `const search = await api.searchSymbols({ query: "UserService" });
const details = await api.getSymbolDetails({ symbolId: search.symbols[0].id });
const impact = await api.impactAnalysis({ symbolId: search.symbols[0].id });
return { search, details, impact };`,
			},
			{
				name: 'Parallel Queries',
				description: 'Get related data in one round-trip (3-10x faster)',
				code: `const [deps, dependents] = await Promise.all([
  api.getDependencies({ filePath: "src/service.ts" }),
  api.getDependents({ filePath: "src/service.ts" })
]);
return { imports: deps.directDependencies, usedBy: dependents.directDependents };`,
			},
			{
				name: 'Conditional Flow',
				description: 'Handle empty results gracefully',
				code: `const search = await api.searchSymbols({ query: "Config", limit: 1 });
if (search.symbols.length === 0) return { error: "Not found" };
return await api.getSymbolDetails({ symbolId: search.symbols[0].id });`,
			},
			{
				name: 'Refactoring Safety Check',
				description: 'Full analysis before modifying code',
				code: `const search = await api.searchSymbols({ query: "processOrder", limit: 1 });
const symbol = search.symbols[0];
const [usage, impact, callGraph] = await Promise.all([
  api.traceSymbolUsage({ symbolId: symbol.id }),
  api.impactAnalysis({ symbolId: symbol.id }),
  api.getCallGraph({ symbolId: symbol.id })
]);
return { symbol, usageCount: usage.directUsages?.length, risk: impact.breakingChangeRisk, callGraph };`,
			},
		];

		// Capture references for use in closures
		const client = this.client;
		const projectContext = this.options.projectContext;

		// Create typed API proxy for Code Mode
		// Maps method names to tool names while maintaining type safety
		const api: ConstellationApi = new Proxy(
			{
				// Special method for discoverability with enhanced metadata
				listMethods: (params?: { query?: string }): ListMethodsResult => {
					let filtered = availableMethods;
					if (params?.query) {
						const q = params.query.toLowerCase();
						filtered = availableMethods.filter(
							(m) =>
								m.name.toLowerCase().includes(q) ||
								m.description.toLowerCase().includes(q) ||
								m.triggerPhrases.some((t) => t.toLowerCase().includes(q)) ||
								m.quickExample.toLowerCase().includes(q),
						);
					}
					return {
						methods: filtered,
						usage: 'Call any method with: await api.methodName(params)',
						example:
							"const result = await api.searchSymbols({ query: 'User' });",
						decisionGuide,
						...(params?.query ? {} : { compositionPatterns }),
						tip: 'Use Promise.all() for parallel queries (3-10x faster).',
						reference: 'constellation://docs/guide',
					};
				},
				// Inline type help - returns method's TypeScript interface summary
				help: (methodName?: string): string => {
					if (!methodName) {
						const methods = Object.keys(METHOD_SUMMARIES);
						return `Available methods: ${methods.join(', ')}\n\nUsage: api.help("methodName") for parameters and return types.`;
					}
					const summary = METHOD_SUMMARIES[methodName];
					if (!summary) {
						return `Unknown method "${methodName}". Run api.listMethods() to see available methods.`;
					}
					return summary;
				},
				// Capability check method - allows AI to verify project state
				getCapabilities: async (): Promise<ProjectCapabilities> => {
					return getProjectCapabilities(client, projectContext);
				},
			} as ConstellationApi,
			{
				get(target, prop) {
					// Handle special methods on target
					if (prop === 'listMethods') {
						return target.listMethods;
					}
					if (prop === 'help') {
						return target.help;
					}
					if (prop === 'getCapabilities') {
						return target.getCapabilities;
					}

					if (typeof prop !== 'string') return undefined;

					// Ignore Promise/thenable inspection (e.g., auto-await checks)
					if (prop === 'then') return undefined;

					// Validate method name against known API methods
					const knownMethodNames = availableMethods.map((m) => m.name);
					if (!knownMethodNames.includes(prop)) {
						// Find closest match for "did you mean?" suggestion
						const propLower = prop.toLowerCase();
						const closest = knownMethodNames.find(
							(m) =>
								m.toLowerCase().startsWith(propLower.slice(0, 4)) ||
								propLower.startsWith(m.toLowerCase().slice(0, 4)),
						);
						return () => {
							throw new Error(
								`Unknown method "api.${prop}()". ` +
									(closest ? `Did you mean "api.${closest}()"? ` : '') +
									'Run api.listMethods() to see available methods.',
							);
						};
					}

					// Convert camelCase to snake_case for tool names
					// searchSymbols -> search_symbols
					const toolName = prop.replace(
						/[A-Z]/g,
						(letter) => `_${letter.toLowerCase()}`,
					);

					// Return async function that calls the executor
					// The type safety is enforced by the ConstellationApi interface
					return async (params: unknown) => {
						return executor(toolName, params);
					};
				},
			},
		);

		// Build sandbox context for code execution
		// Note: vm.createContext() provides isolated built-in prototypes automatically,
		// so we don't need to spread isolatedBuiltins here. The freeze happens after
		// context creation to freeze the context's own built-in prototypes.
		const sandbox: any = {
			// Core API
			api,
		};

		// Conditionally add console with size-optimized output
		if (this.options.allowConsole) {
			const formatArg = (arg: any): string => {
				if (typeof arg !== 'object' || arg === null) {
					return String(arg);
				}
				try {
					const json = JSON.stringify(arg, null, 2);
					if (json.length > MAX_CONSOLE_OBJECT_SIZE) {
						// Use compact format for large objects
						const compact = JSON.stringify(arg);
						if (compact.length > MAX_CONSOLE_OBJECT_SIZE) {
							return compact.substring(0, MAX_CONSOLE_OBJECT_SIZE - 3) + '...';
						}
						return compact;
					}
					return json;
				} catch (error) {
					// FIX SB-84: Log serialization failures instead of silent fallback
					// This helps debug circular references, BigInt values, or other non-serializable types
					const errorMsg =
						error instanceof Error ? error.message : 'unknown error';
					logs.push(
						`[WARN] JSON serialization failed: ${errorMsg}. Falling back to String().`,
					);
					return String(arg);
				}
			};

			// Freeze console object to prevent modification (SB-102)
			sandbox.console = Object.freeze({
				log: (...args: any[]) => {
					const message = args.map(formatArg).join(' ');
					logs.push(message);
				},
				error: (...args: any[]) => {
					const message = args.map(formatArg).join(' ');
					logs.push(`[ERROR] ${message}`);
				},
				warn: (...args: any[]) => {
					const message = args.map(formatArg).join(' ');
					logs.push(`[WARN] ${message}`);
				},
				info: (...args: any[]) => {
					const message = args.map(formatArg).join(' ');
					logs.push(`[INFO] ${message}`);
				},
				debug: (...args: any[]) => {
					const message = args.map(formatArg).join(' ');
					logs.push(`[DEBUG] ${message}`);
				},
			});
		}

		// Conditionally add timers with lifecycle tracking (SB-258 Step 3.2)
		// Wraps timer functions to track active timers and clean them up
		// when sandbox execution completes, preventing callbacks from outliving the sandbox.
		if (this.options.allowTimers) {
			// Track active timer/interval handles for cleanup (type varies by runtime)
			const activeTimers = new Set<any>();
			const activeIntervals = new Set<any>();

			sandbox.setTimeout = (fn: Function, ms: number, ...args: any[]) => {
				const id = setTimeout(() => {
					activeTimers.delete(id);
					fn(...args);
				}, ms);
				activeTimers.add(id);
				return id;
			};
			sandbox.setInterval = (fn: Function, ms: number, ...args: any[]) => {
				const id = setInterval(fn, ms, ...args);
				activeIntervals.add(id);
				return id;
			};
			sandbox.clearTimeout = (id: any) => {
				activeTimers.delete(id);
				clearTimeout(id);
			};
			sandbox.clearInterval = (id: any) => {
				activeIntervals.delete(id);
				clearInterval(id);
			};

			// Store cleanup callback for execute()'s finally block
			executionState.timerCleanup = () => {
				activeTimers.forEach((id) => clearTimeout(id));
				activeIntervals.forEach((id) => clearInterval(id));
				activeTimers.clear();
				activeIntervals.clear();
			};
		}

		// Freeze the sandbox object to prevent adding/removing properties (SB-102)
		return Object.freeze(sandbox);
	}

	/**
	 * Wrap code in async IIFE if needed
	 */
	private wrapCode(code: string): string {
		// Check if code is already wrapped or is a function
		const trimmed = code.trim();

		// If it's already an async function or IIFE, use as-is
		// Note: We still prepend "use strict" to ensure frozen prototype protection
		if (trimmed.startsWith('(async') || trimmed.startsWith('async function')) {
			return `"use strict";\n${code}`;
		}

		// SB-151: Auto-return last expression when no explicit return is present
		const transformed = addAutoReturn(code);

		// Wrap in async IIFE for top-level await support
		// "use strict" ensures modifications to frozen objects throw errors (SB-102)
		return `"use strict";
(async () => {
${transformed}
})()`;
	}

	/**
	 * Format error for user-friendly output
	 */
	private formatError(error: any): string {
		if (error instanceof Error) {
			if (error.message.includes('Script execution timed out')) {
				return `Execution timeout: Code took longer than ${this.options.timeout}ms to execute`;
			}
			if (error instanceof MemoryExceededError) {
				return error.message; // Already formatted nicely
			}
			return error.message;
		}
		return String(error);
	}

	/**
	 * Validate code before execution (optional pre-flight check)
	 * Returns errors (blocking) and warnings (informational)
	 */
	validateCode(code: string): {
		valid: boolean;
		errors?: string[];
		warnings?: string[];
	} {
		const errors: string[] = [];

		// Check for dangerous patterns
		const dangerousPatterns = [
			/require\s*\(/, // No require() calls
			/import\s+/, // No import statements
			/eval\s*\(/, // No eval()
			/Function\s*\(/, // No Function constructor
			/__proto__/, // No prototype pollution
			/process\./, // No process access
			/child_process/, // No child processes
			/fs\./, // No file system access
			/net\./, // No network access
			/http\./, // No HTTP module
			// Additional escape vectors
			/\.constructor\s*(?:\[|\.|\()/, // Block [].constructor.constructor
			/\bglobalThis\b/, // Block globalThis access
			/\bwith\s*\(/, // Block with statement
			/Symbol\s*\.\s*unscopables/, // Block Symbol.unscopables
			/\bReflect\s*\./, // Block Reflect API
			/\bnew\s+Proxy\s*\(/, // Block direct Proxy construction
		];

		for (const pattern of dangerousPatterns) {
			if (pattern.test(code)) {
				errors.push(`Dangerous pattern detected: ${pattern.source}`);
			}
		}

		// Check for infinite loops (basic detection)
		if (/while\s*\(\s*true\s*\)/.test(code)) {
			errors.push('Potential infinite loop detected: while(true)');
		}

		if (/for\s*\(\s*;\s*;\s*\)/.test(code)) {
			errors.push('Potential infinite loop detected: for(;;)');
		}

		// === Phase 2: AST-based validation (SB-101) ===
		// Catches bypass vectors that regex can miss (computed property access, etc.)
		const astResult = validateAst(code);

		if (!astResult.valid) {
			for (const err of astResult.errors) {
				const location = err.location
					? ` at line ${err.location.line}, column ${err.location.column}`
					: '';
				errors.push(`[AST] ${err.message}${location}`);
			}
		}

		// === Warnings for common mistakes (informational, don't block execution) ===
		const warnings: string[] = [];

		// Add AST-level warnings (e.g., computed-dynamic-property, SB-258)
		if (astResult.warnings.length > 0) {
			warnings.push(...astResult.warnings.map((w) => `[AST] ${w}`));
		}

		// Add parse warning if AST couldn't parse (syntax error - VM will catch it)
		if (astResult.parseError) {
			warnings.push(astResult.parseError);
		}

		// Check for missing return statement (informational with auto-return)
		// Only warn for non-trivial code — simple expressions are handled
		// correctly by auto-return and the warning just adds noise.
		const hasApiCall = /api\.\w+\s*\(/.test(code);
		const hasReturn = /\breturn\b/.test(code);
		const statementCount = code.split('\n').filter((line) => {
			const trimmed = line.trim();
			return trimmed.length > 0 && !trimmed.startsWith('//');
		}).length;
		if (hasApiCall && !hasReturn && statementCount > 2) {
			warnings.push(
				'No explicit return statement detected. Auto-return will be applied to the last expression. ' +
					'For complex control flow, add an explicit return to ensure correct results.',
			);
		}

		// Check for missing await (common mistake)
		// Skip warning if code uses Promise.all — the await is on Promise.all, not individual calls
		const apiCallCount = (code.match(/api\.\w+\s*\(/g) || []).length;
		const awaitCount = (code.match(/\bawait\b/g) || []).length;
		const hasPromiseAll = /Promise\.all\s*\(/.test(code);
		if (apiCallCount > 0 && awaitCount === 0 && !hasPromiseAll) {
			warnings.push(
				'No await detected but api calls found. API methods are async. ' +
					'Use "await api.methodName(...)" or "await Promise.all([...])"',
			);
		}

		// Check for .then() without error handling
		if (/\.then\s*\(/.test(code) && !/\.catch\s*\(/.test(code)) {
			warnings.push(
				'Using .then() without .catch(). Consider using async/await or adding error handling.',
			);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	}
}
