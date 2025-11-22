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
          language: 'javascript',
          sandboxed: false,
          validated: false
        }
      };
    }

    // Execute in sandbox (JavaScript only)
    const result = await this.sandbox.execute(request.code);

    // Format response
    return {
      success: result.success,
      result: result.result,
      error: result.error,
      logs: result.logs,
      executionTime: result.executionTime,
      metadata: {
        language: 'javascript',
        sandboxed: true,
        validated: true
      }
    };
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