/**
 * Code Mode Runtime
 *
 * Main runtime engine for executing Code Mode scripts.
 * Manages sandbox creation, code execution, and result formatting.
 */

import { CodeModeSandbox, SandboxOptions, SandboxResult } from './sandbox.js';
import { getConfigContext } from '../config/config-manager.js';

/**
 * Code Mode execution request
 */
export interface CodeModeRequest {
  code: string;
  language?: 'typescript' | 'javascript';
  timeout?: number;
  projectContext?: {
    projectId: string;
    branchName: string;
  };
}

/**
 * Code Mode execution response
 */
export interface CodeModeResponse {
  success: boolean;
  result?: any;
  error?: string;
  logs?: string[];
  executionTime?: number;
  metadata?: {
    language: string;
    sandboxed: boolean;
    validated: boolean;
  };
  [x: string]: unknown; // Index signature for MCP SDK compatibility
}

/**
 * Code Mode Runtime Engine
 */
export class CodeModeRuntime {
  private sandbox: CodeModeSandbox;

  constructor(options: SandboxOptions = {}) {
    this.sandbox = new CodeModeSandbox(options);
  }

  /**
   * Execute Code Mode script
   */
  async execute(request: CodeModeRequest): Promise<CodeModeResponse> {
    console.error('[CodeModeRuntime] Executing code mode script');

    // Validate the code first
    const validation = this.sandbox.validateCode(request.code);
    if (!validation.valid) {
      console.error('[CodeModeRuntime] Code validation failed:', validation.errors);
      return {
        success: false,
        error: `Code validation failed:\n${validation.errors?.join('\n')}`,
        metadata: {
          language: request.language || 'javascript',
          sandboxed: false,
          validated: false
        }
      };
    }

    // Preprocess TypeScript if needed
    let processedCode = request.code;
    if (request.language === 'typescript') {
      processedCode = this.preprocessTypeScript(request.code);
    }

    // Execute in sandbox
    const result = await this.sandbox.execute(processedCode);

    // Format response
    return {
      success: result.success,
      result: result.result,
      error: result.error,
      logs: result.logs,
      executionTime: result.executionTime,
      metadata: {
        language: request.language || 'javascript',
        sandboxed: true,
        validated: true
      }
    };
  }

  /**
   * Preprocess TypeScript code (strip types for now)
   *
   * In a production environment, you'd use the TypeScript compiler
   * to properly transpile to JavaScript.
   */
  private preprocessTypeScript(code: string): string {
    // For now, just strip type annotations (basic implementation)
    // In production, use typescript compiler API

    let processed = code;

    // Remove type annotations from function parameters and variables
    // FIXED: Use negative lookbehind to avoid matching object literal properties
    // Match ': type' only when NOT preceded by an identifier (to preserve {key: value})
    processed = processed.replace(/\((.*?)\)/g, (match, params) => {
      // Only process function parameters
      return '(' + params.replace(/:\s*\w+(\[\])?/g, '') + ')';
    });

    // Remove variable type annotations (const x: Type = ...)
    processed = processed.replace(/(const|let|var)\s+(\w+)\s*:\s*\w+(\[\])?/g, '$1 $2');

    // Remove interface declarations
    processed = processed.replace(/interface\s+\w+\s*{[^}]*}/g, '');

    // Remove type declarations
    processed = processed.replace(/type\s+\w+\s*=\s*[^;]+;/g, '');

    // Remove generic type parameters
    processed = processed.replace(/<[^>]+>/g, '');

    // Remove 'as' type assertions
    processed = processed.replace(/\s+as\s+\w+/g, '');

    return processed;
  }

  /**
   * Format execution result for display (token-optimized JSON format)
   */
  formatResult(response: CodeModeResponse): string {
    const output: any = {
      success: response.success
    };

    if (response.success) {
      // Success response
      if (response.result !== undefined) {
        output.result = response.result;
      }
      if (response.logs && response.logs.length > 0) {
        output.logs = response.logs;
      }
      if (response.executionTime) {
        output.time = response.executionTime;
      }
    } else {
      // Error response
      if (response.error) {
        output.error = response.error;
      }
      if (response.logs && response.logs.length > 0) {
        output.logs = response.logs;
      }
    }

    return JSON.stringify(output, null, 2);
  }

  /**
   * Format a value for display
   */
  private formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }
}

/**
 * Create a Code Mode runtime with default configuration
 */
export function createCodeModeRuntime(): CodeModeRuntime {
  const configContext = getConfigContext();

  return new CodeModeRuntime({
    timeout: 30000, // 30 seconds
    allowConsole: true,
    allowTimers: false,
    projectContext: {
      projectId: configContext.projectId,
      branchName: configContext.branchName
    }
  });
}