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

/**
 * Sandbox configuration options
 */
export interface SandboxOptions {
	timeout?: number; // Maximum execution time in milliseconds
	memoryLimit?: number; // Memory limit in MB (future enhancement)
	allowConsole?: boolean; // Allow console.log/error in sandbox
	allowTimers?: boolean; // Allow setTimeout/setInterval
	projectContext?: {
		projectId: string;
		branchName: string;
	};
}

/**
 * Sandbox execution result
 */
export interface SandboxResult {
	success: boolean;
	result?: any;
	error?: string;
	/** Structured error for AI consumption (preserves error type information) */
	structuredError?: McpErrorResponse;
	logs?: string[];
	executionTime: number;
}

/**
 * Code Mode Sandbox for secure code execution
 */
export class CodeModeSandbox {
	private options: Required<SandboxOptions>;
	private client: ConstellationClient;

	constructor(options: SandboxOptions = {}) {
		this.options = {
			timeout: options.timeout || 30000, // 30 seconds default
			memoryLimit: options.memoryLimit || 128, // 128MB default
			allowConsole: options.allowConsole !== false,
			allowTimers: options.allowTimers || false,
			projectContext: options.projectContext || this.getDefaultContext(),
		};

		// Initialize constellation client
		const configContext = getConfigContext();
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
			const result = await script.runInContext(context, {
				timeout: this.options.timeout,
				breakOnSigint: true,
			});

			return {
				success: true,
				result,
				logs,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			// Create structured error to preserve error type information
			const structuredError = createStructuredError(error, 'execute');

			return {
				success: false,
				error: this.formatError(error),
				structuredError,
				logs,
				executionTime: Date.now() - startTime,
			};
		}
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

		// Create API executor that calls through to our client with enhanced error context
		const executor = async (toolName: string, params: any) => {
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

		// Available API methods for listMethods()
		const availableMethods = [
			{
				name: 'searchSymbols',
				description: 'Search for symbols by name/pattern',
			},
			{
				name: 'getSymbolDetails',
				description: 'Get detailed info about a symbol',
			},
			{ name: 'getDependencies', description: 'Get what a file depends on' },
			{ name: 'getDependents', description: 'Get what depends on a file' },
			{
				name: 'findCircularDependencies',
				description: 'Find circular dependency cycles',
			},
			{ name: 'traceSymbolUsage', description: 'Find all usages of a symbol' },
			{ name: 'getCallGraph', description: 'Get function call relationships' },
			{ name: 'findOrphanedCode', description: 'Find unused/dead code' },
			{ name: 'impactAnalysis', description: 'Analyze change impact' },
			{
				name: 'getArchitectureOverview',
				description: 'Get high-level project structure',
			},
		];

		// Create simple API proxy for Code Mode
		// Maps method names to tool names
		const api = new Proxy(
			{
				// Special method for discoverability
				listMethods: () => ({
					methods: availableMethods,
					usage: 'Call any method with: await api.methodName(params)',
					example: "const result = await api.searchSymbols({ query: 'User' });",
				}),
			},
			{
				get(target, prop) {
					// Handle listMethods specially (it's on target)
					if (prop === 'listMethods') {
						return (target as any).listMethods;
					}

					if (typeof prop !== 'string') return undefined;

					// Convert camelCase to snake_case for tool names
					// searchSymbols -> search_symbols
					const toolName = prop.replace(
						/[A-Z]/g,
						(letter) => `_${letter.toLowerCase()}`,
					);

					// Return async function that calls the executor
					return async (params: any) => {
						return executor(toolName, params);
					};
				},
			},
		);

		// Build sandbox context
		const sandbox: any = {
			// Core API
			api,

			// Standard JavaScript features
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
		};

		// Conditionally add console with size-optimized output
		if (this.options.allowConsole) {
			const MAX_OBJECT_SIZE = 500;

			const formatArg = (arg: any): string => {
				if (typeof arg !== 'object' || arg === null) {
					return String(arg);
				}
				try {
					const json = JSON.stringify(arg, null, 2);
					if (json.length > MAX_OBJECT_SIZE) {
						// Use compact format for large objects
						const compact = JSON.stringify(arg);
						if (compact.length > MAX_OBJECT_SIZE) {
							return compact.substring(0, MAX_OBJECT_SIZE - 3) + '...';
						}
						return compact;
					}
					return json;
				} catch {
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
	 * Get default project context from configuration
	 */
	private getDefaultContext(): { projectId: string; branchName: string } {
		const configContext = getConfigContext();
		return {
			projectId: configContext.projectId,
			branchName: configContext.branchName,
		};
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
