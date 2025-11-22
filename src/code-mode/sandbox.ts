/**
 * Code Mode Sandbox
 *
 * Provides a secure sandboxed environment for executing user-generated
 * JavaScript code with access to the Constellation API.
 */

import vm from 'vm';
import { ConstellationClient } from '../client/constellation-client.js';
import { getConfigContext } from '../config/config-manager.js';

/**
 * Sandbox configuration options
 */
export interface SandboxOptions {
  timeout?: number;           // Maximum execution time in milliseconds
  memoryLimit?: number;       // Memory limit in MB (future enhancement)
  allowConsole?: boolean;     // Allow console.log/error in sandbox
  allowTimers?: boolean;      // Allow setTimeout/setInterval
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
      projectContext: options.projectContext || this.getDefaultContext()
    };

    // Initialize constellation client
    const configContext = getConfigContext();
    this.client = new ConstellationClient(
      configContext.config,
      configContext.apiKey
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
        filename: 'code-mode-script.js'
      });

      const context = vm.createContext(sandbox);
      const result = await script.runInContext(context, {
        timeout: this.options.timeout,
        breakOnSigint: true
      });

      return {
        success: true,
        result,
        logs,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
        logs,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create sandbox context with API and utilities
   */
  private createSandboxContext(logs: string[]): any {
    // Create API executor that calls through to our client
    const executor = async (toolName: string, params: any) => {
      const result = await this.client.executeMcpTool(
        toolName,
        params,
        this.options.projectContext
      );

      if (!result.success) {
        throw new Error(result.error || 'Tool execution failed');
      }

      return result.data;
    };

    // Create simple API proxy for Code Mode
    // Maps method names to tool names
    const api = new Proxy({}, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined;

        // Convert camelCase to snake_case for tool names
        // searchSymbols -> search_symbols
        const toolName = prop.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

        // Return async function that calls the executor
        return async (params: any) => {
          return executor(toolName, params);
        };
      }
    });

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

      // Async utilities
      async: true,
      await: true,
    };

    // Conditionally add console
    if (this.options.allowConsole) {
      sandbox.console = {
        log: (...args: any[]) => {
          const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          logs.push(message);
        },
        error: (...args: any[]) => {
          const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          logs.push(`[ERROR] ${message}`);
        },
        warn: (...args: any[]) => {
          const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          logs.push(`[WARN] ${message}`);
        },
        info: (...args: any[]) => {
          const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          logs.push(`[INFO] ${message}`);
        }
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
      branchName: configContext.branchName
    };
  }

  /**
   * Validate code before execution (optional pre-flight check)
   */
  validateCode(code: string): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/,           // No require() calls
      /import\s+/,              // No import statements
      /eval\s*\(/,              // No eval()
      /Function\s*\(/,          // No Function constructor
      /__proto__/,              // No prototype pollution
      /process\./,              // No process access
      /child_process/,          // No child processes
      /fs\./,                   // No file system access
      /net\./,                  // No network access
      /http\./,                 // No HTTP module
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

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}