/**
 * Execute Code Tool
 *
 * MCP tool for executing TypeScript/JavaScript code in Code Mode.
 * Provides a sandboxed environment with access to all Constellation API tools.
 */

import { z } from 'zod';
import { MCPTool } from 'mcp-framework';
import { CodeModeRuntime, CodeModeRequest } from '../../code-mode/runtime.js';
import { getConfigContext } from '../../config/config-manager.js';

class ExecuteCodeTool extends MCPTool<CodeModeRequest> {
  name = 'execute_code';
  description =
    'THE ONLY AVAILABLE TOOL. Execute TypeScript code to interact with Constellation. ' +
    'You MUST use this tool for ALL operations - searching, analyzing dependencies, getting details, etc. ' +
    'Write TypeScript code using the api object: api.searchSymbols(), api.getDependencies(), api.traceSymbolUsage(), etc. ' +
    'This is a Code Mode-only server. There are NO other tools. Always write TypeScript code.';

  schema = z.object({
    code: z.string().min(1).describe(
      'TypeScript code to execute. Can use top-level await. ' +
      'Available API methods: searchSymbols, getSymbolDetails, getDependencies, ' +
      'getDependents, findCircularDependencies, traceSymbolUsage, getCallGraph, ' +
      'findOrphanedCode, impactAnalysis, getArchitectureOverview'
    ),
    timeout: z.number().min(1000).max(60000).optional().default(30000).describe(
      'Maximum execution time in milliseconds (default: 30000, max: 60000)'
    ),
  });

  /**
   * Execute the code in sandboxed environment
   */
  async execute(input: CodeModeRequest): Promise<string> {
    console.error('[ExecuteCodeTool] Executing code mode script');

    try {
      // Create runtime
      const runtime = new CodeModeRuntime({
        timeout: input.timeout || 30000,
        allowConsole: true,
        allowTimers: false
      });

      // Execute the code (always TypeScript)
      const response = await runtime.execute({
        code: input.code,
        language: 'typescript',
        timeout: input.timeout
      });

      // Format the response
      return runtime.formatResult(response);
    } catch (error) {
      console.error('[ExecuteCodeTool] Execution error:', error);
      return this.formatError(error);
    }
  }

  /**
   * Format error for display (token-optimized JSON format)
   */
  private formatError(error: any): string {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, null, 2);
  }
}

export default ExecuteCodeTool;