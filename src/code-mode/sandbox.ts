/**
 * Code Mode Sandbox
 *
 * Provides a secure sandboxed environment for executing user-generated
 * JavaScript code with access to the Constellation API.
 */

import vm from 'vm';
import { ConstellationClient } from '../client/constellation-client.js';
import { getConfigContext } from '../config/config-manager.js';
import { createStructuredError } from '../client/error-factory.js';
import type { McpErrorResponse } from '../types/mcp-errors.js';
import type { McpToolResult } from '../types/mcp-response.js';
import {
	getProjectCapabilities,
	type ProjectCapabilities,
} from './capabilities.js';

// Import API types to ensure type safety and establish dependency
import type {
	SearchSymbolsParams,
	SearchSymbolsResult,
	GetSymbolDetailsParams,
	GetSymbolDetailsResult,
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
} from '../types/api-types.js';

/** Maximum size of objects to fully serialize in console output */
const MAX_CONSOLE_OBJECT_SIZE = 500;

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
}

/**
 * Response from api.listMethods()
 */
export interface ListMethodsResult {
	methods: MethodInfo[];
	usage: string;
	example: string;
	decisionGuide: Record<string, string>;
	tip: string;
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
	): Promise<GetSymbolDetailsResult>;

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
	listMethods(): ListMethodsResult;
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
 * });
 * ```
 */
export interface SandboxOptions {
	/**
	 * Maximum execution time in milliseconds.
	 * @default 30000 (30 seconds)
	 */
	timeout?: number;

	/**
	 * Memory limit in MB (reserved for future enhancement).
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
	 * Defaults to values from ConfigContext.
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
}

/**
 * Code Mode Sandbox for secure code execution
 */
export class CodeModeSandbox {
	private options: Required<SandboxOptions>;
	private client: ConstellationClient;

	constructor(options: SandboxOptions = {}) {
		// FIX SB-83: Get config context first to fail-fast if not initialized
		// This prevents race conditions where client operations fail later with confusing errors
		const configContext = getConfigContext();

		// Validate config is properly initialized before proceeding
		if (!configContext.config || !configContext.apiKey) {
			throw new Error(
				'Configuration not initialized. Ensure CONSTELLATION_ACCESS_KEY and CONSTELLATION_API_URL are set.',
			);
		}

		this.options = {
			timeout: options.timeout || 30000, // 30 seconds default
			memoryLimit: options.memoryLimit || 128, // 128MB default
			allowConsole: options.allowConsole !== false,
			allowTimers: options.allowTimers || false,
			maxApiCalls: options.maxApiCalls || 50, // Default 50 API calls per execution
			projectContext: options.projectContext || {
				projectId: configContext.projectId,
				branchName: configContext.branchName,
			},
		};

		// Initialize constellation client with validated config
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

		// Self-protective validation (defense in depth)
		// Even if validation happens externally (runtime.ts), we validate here too
		// to protect against direct instantiation bypassing external checks
		const validation = this.validateCode(code);
		if (!validation.valid) {
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

		// FIX: Declare timeoutHandle outside try block so it can be cleaned up in all paths
		const timeoutMs = this.options.timeout;
		let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
		// FIX: Guard flag to prevent double rejection when both VM timeout and Promise timeout fire
		let hasTimedOut = false;

		try {
			// Create sandbox context with API bindings
			const sandbox = this.createSandboxContext(logs);

			// Wrap code in async IIFE if not already
			const wrappedCode = this.wrapCode(code);

			// Create and run script in sandbox
			const script = new vm.Script(wrappedCode, {
				filename: 'code-mode-script.js',
			});

			const context = vm.createContext(sandbox);

			// FIX SB-85: VM timeout only applies to synchronous execution.
			// Async code (including our async IIFE wrapper) returns a Promise immediately,
			// which means infinite async loops would bypass the timeout.
			// Use Promise.race() to enforce timeout on the entire async execution.
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => {
					// FIX: Only reject if not already handled (prevents double rejection)
					if (!hasTimedOut) {
						hasTimedOut = true;
						reject(new Error('Script execution timed out'));
					}
				}, timeoutMs);
			});

			// Run script with VM timeout (catches sync hangs) and race with timeout Promise (catches async hangs)
			// Note: breakOnSigint uses POSIX signals which don't work on Windows
			const scriptResult = script.runInContext(context, {
				timeout: timeoutMs,
				breakOnSigint: process.platform !== 'win32',
			});

			// Race the script result (which may be a Promise) against the timeout
			const result = await Promise.race([
				Promise.resolve(scriptResult),
				timeoutPromise,
			]);

			return {
				success: true,
				result,
				logs,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			// FIX: Mark as handled to prevent any pending timeout callbacks from firing
			hasTimedOut = true;

			// Create structured error to preserve error type information
			const structuredError = createStructuredError(error, 'execute');

			return {
				success: false,
				error: this.formatError(error),
				structuredError,
				logs,
				executionTime: Date.now() - startTime,
			};
		} finally {
			// FIX: Mark as handled to prevent any pending timeout callbacks from firing
			hasTimedOut = true;

			// FIX: Clean up timeout in ALL paths (success, VM timeout error, or other errors)
			// This prevents unhandled promise rejections when VM's internal timeout fires
			// before the Promise-based timeout, leaving the setTimeout dangling
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
		}
	}

	/**
	 * Create isolated built-in constructors to prevent prototype pollution.
	 * By running constructors from a separate VM context, any modifications
	 * to prototypes (e.g., Array.prototype.polluted = true) are isolated
	 * to that context and don't affect the host environment.
	 */
	private createIsolatedBuiltins(): Record<string, unknown> {
		const isolatedContext = vm.createContext({});
		return vm.runInContext(
			`({
			Promise,
			Array,
			Object,
			String,
			Number,
			Boolean,
			Date,
			JSON,
			Math,
			RegExp,
			Map,
			Set,
		})`,
			isolatedContext,
		);
	}

	/**
	 * Create sandbox context with API and utilities
	 */
	private createSandboxContext(logs: string[]): any {
		// Helper to convert snake_case to camelCase for display
		const snakeToCamel = (str: string): string => {
			return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
		};

		// Helper to summarize params for error display (truncate large objects)
		const summarizeParams = (params: any): string => {
			try {
				const json = JSON.stringify(params);
				if (json.length > 100) {
					return json.substring(0, 97) + '...';
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
					throw new Error(
						`API call failed: api.${snakeToCamel(toolName)}()\n` +
							`  Parameters: ${paramsPreview}\n` +
							`  Duration: ${duration}ms\n` +
							`  Error: ${result.error || 'Unknown error'}`,
					);
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
			},
			{
				name: 'getSymbolDetails',
				description: 'Get detailed info about a symbol',
				triggerPhrases: ['symbol details', 'more info about'],
				quickExample: `await api.getSymbolDetails({ symbolId: "..." })`,
			},
			{
				name: 'getDependencies',
				description: 'Get what a file depends on',
				triggerPhrases: ['what imports', 'dependencies of', 'what does it use'],
				quickExample: `await api.getDependencies({ filePath: "src/index.ts" })`,
			},
			{
				name: 'getDependents',
				description: 'Get what depends on a file',
				triggerPhrases: ['what uses this', 'who imports', 'dependents of'],
				quickExample: `await api.getDependents({ filePath: "src/utils.ts" })`,
			},
			{
				name: 'findCircularDependencies',
				description: 'Find circular dependency cycles',
				triggerPhrases: [
					'circular dependency',
					'import cycle',
					'dependency loop',
				],
				quickExample: `await api.findCircularDependencies({ maxDepth: 10 })`,
			},
			{
				name: 'traceSymbolUsage',
				description: 'Find all usages of a symbol',
				triggerPhrases: ['where is used', 'find usages', 'trace usage'],
				quickExample: `await api.traceSymbolUsage({ symbolName: "User", filePath: "..." })`,
			},
			{
				name: 'getCallGraph',
				description: 'Get function call relationships',
				triggerPhrases: ['what calls', 'called by', 'call graph'],
				quickExample: `await api.getCallGraph({ symbolName: "process", filePath: "..." })`,
			},
			{
				name: 'findOrphanedCode',
				description: 'Find unused/dead code',
				triggerPhrases: ['unused code', 'dead code', 'orphaned', 'can delete'],
				quickExample: `await api.findOrphanedCode({ limit: 20 })`,
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
				quickExample: `await api.impactAnalysis({ symbolName: "Config", filePath: "..." })`,
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
			},
			{
				name: 'getCapabilities',
				description: 'Check project indexing status and available features',
				triggerPhrases: ['is indexed', 'project status', 'capabilities'],
				quickExample: `await api.getCapabilities()`,
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

		// Capture references for use in closures
		const client = this.client;
		const projectContext = this.options.projectContext;

		// Parameter transformation for known MCP → Core mismatches
		// This handles cases where MCP api-types.ts uses different param names than Core executors
		const transformParams = (toolName: string, params: any): any => {
			if (!params || typeof params !== 'object') return params;

			// Make a shallow copy to avoid mutating the original
			const transformed = { ...params };

			// search_symbols: MCP uses 'isExported', Core expects 'filterByExported'
			if (toolName === 'search_symbols' && 'isExported' in transformed) {
				transformed.filterByExported = transformed.isExported;
				delete transformed.isExported;
			}

			return transformed;
		};

		// Create typed API proxy for Code Mode
		// Maps method names to tool names while maintaining type safety
		const api: ConstellationApi = new Proxy(
			{
				// Special method for discoverability with enhanced metadata
				listMethods: (): ListMethodsResult => ({
					methods: availableMethods,
					usage: 'Call any method with: await api.methodName(params)',
					example: "const result = await api.searchSymbols({ query: 'User' });",
					decisionGuide,
					tip: 'Use decisionGuide to match user intent to the right method',
				}),
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
					if (prop === 'getCapabilities') {
						return target.getCapabilities;
					}

					if (typeof prop !== 'string') return undefined;

					// Convert camelCase to snake_case for tool names
					// searchSymbols -> search_symbols
					const toolName = prop.replace(
						/[A-Z]/g,
						(letter) => `_${letter.toLowerCase()}`,
					);

					// Return async function that calls the executor
					// The type safety is enforced by the ConstellationApi interface
					return async (params: unknown) => {
						// Transform params for known mismatches between MCP and Core
						const transformedParams = transformParams(toolName, params);
						return executor(toolName, transformedParams);
					};
				},
			},
		);

		// Build sandbox context with isolated built-ins to prevent prototype pollution
		const isolatedBuiltins = this.createIsolatedBuiltins();
		const sandbox: any = {
			// Core API
			api,

			// Standard JavaScript features (isolated to prevent prototype pollution)
			...isolatedBuiltins,
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

			sandbox.console = {
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
			};
		}

		// Conditionally add timers (generally not recommended for security)
		if (this.options.allowTimers) {
			sandbox.setTimeout = setTimeout;
			sandbox.setInterval = setInterval;
			sandbox.clearTimeout = clearTimeout;
			sandbox.clearInterval = clearInterval;
		}

		return sandbox;
	}

	/**
	 * Wrap code in async IIFE if needed
	 */
	private wrapCode(code: string): string {
		// Check if code is already wrapped or is a function
		const trimmed = code.trim();

		// If it's already an async function or IIFE, use as-is
		if (trimmed.startsWith('(async') || trimmed.startsWith('async function')) {
			return code;
		}

		// Wrap in async IIFE for top-level await support
		return `(async () => {
${code}
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

		// === Warnings for common mistakes (informational, don't block execution) ===
		const warnings: string[] = [];

		// Check for missing return statement (common mistake)
		const hasApiCall = /api\.\w+\s*\(/.test(code);
		const hasReturn = /\breturn\b/.test(code);
		if (hasApiCall && !hasReturn) {
			warnings.push(
				'No return statement detected. Results from api calls will not be returned. ' +
					'Did you forget to add "return" before your result?',
			);
		}

		// Check for missing await (common mistake)
		const apiCallCount = (code.match(/api\.\w+\s*\(/g) || []).length;
		const awaitCount = (code.match(/\bawait\b/g) || []).length;
		if (apiCallCount > 0 && awaitCount === 0) {
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
