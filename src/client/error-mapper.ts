/**
 * Error Mapper - Converts API errors into helpful, actionable messages
 *
 * Maps HTTP errors and API responses into user-friendly guidance
 */

import { getConfigContext } from '../config/config-manager.js';
import { standardErrors } from '../utils/error-messages.js';
import {
	AuthenticationError,
	NotFoundError,
	ToolNotFoundError,
} from './constellation-client.js';

/**
 * Map an error to a helpful message with actionable guidance
 *
 * @param error Error object
 * @param toolName Name of the tool that failed
 * @returns Helpful error message with guidance
 */
export function mapErrorToMessage(error: unknown, toolName: string): string {
	// Handle known error types
	if (error instanceof AuthenticationError) {
		return formatAuthenticationError();
	}

	if (error instanceof NotFoundError) {
		return formatNotFoundError(toolName);
	}

	if (error instanceof ToolNotFoundError) {
		return formatToolNotFoundError(error.message);
	}

	// Handle generic Error objects
	if (error instanceof Error) {
		return formatGenericError(toolName, error);
	}

	// Handle unknown error types
	return formatUnknownError(toolName, error);
}

/**
 * Format authentication error with helpful guidance
 */
function formatAuthenticationError(): string {
	const context = getConfigContext();

	return `Authentication Failed

The Constellation API rejected your access key.

**How to fix this:**

Set up authentication using the CLI:
\`constellation auth\`

This will configure your API key properly.

For more information, visit: https://docs.constellationdev.io/
`;
}

/**
 * Format not found error (project not indexed)
 */
function formatNotFoundError(toolName: string): string {
	const context = getConfigContext();

	return `Project Not Indexed

The tool "${toolName}" cannot find your project in the Constellation index.

**Project Details:**
  Project ID: ${context.projectId}
  Branch: ${context.branchName}

**To fix this:**
1. Index your codebase first:
   $ constellation index

2. Or set up automatic indexing in your CI/CD pipeline

3. Verify you're targeting the correct branch:
   $ git branch --show-current

**Note:** Each branch maintains a separate index. If you switched branches,
you'll need to index the new branch first.

For more information, visit: https://docs.constellationdev.io/getting-started
`;
}

/**
 * Format tool not found error
 */
function formatToolNotFoundError(message: string): string {
	return `Tool Not Found

${message}

**Available tool categories:**
  • Discovery tools: search_symbols, get_symbol_details
  • Dependency tools: get_dependencies, get_dependents, find_circular_dependencies, trace_symbol_usage, get_call_graph
  • Impact tools: impact_analysis, find_orphaned_code
  • Architecture tools: get_architecture_overview

**To see all available tools:**
  Query the tool catalog through the MCP interface or API

For more information, visit: https://docs.constellationdev.io/tools
`;
}

/**
 * Format generic error with context
 */
function formatGenericError(toolName: string, error: Error): string {
	const context = getConfigContext();

	// FIX SB-89: Check error.code first (standard Node.js pattern), then fall back to message
	const errorWithCode = error as Error & { code?: string };
	const isNetworkError =
		// Standard Node.js error codes
		errorWithCode.code === 'ECONNREFUSED' ||
		errorWithCode.code === 'ENOTFOUND' ||
		errorWithCode.code === 'ETIMEDOUT' ||
		errorWithCode.code === 'ECONNRESET' ||
		errorWithCode.code === 'ECONNABORTED' ||
		// Fallback to message only for non-standard errors (e.g., fetch API)
		(errorWithCode.code === undefined &&
			(error.message.toLowerCase().includes('fetch failed') ||
				error.message.toLowerCase().includes('network') ||
				error.message.toLowerCase().includes('timeout')));

	if (isNetworkError) {
		return `${toolName} Failed\n\n${standardErrors.apiError(
			toolName,
			undefined,
			error.message,
		)}\n\n**Context:**\n  Project ID: ${context.projectId}\n  Branch: ${context.branchName}`;
	}

	let output = `${toolName} Failed

${error.message}

**Context:**
  Project ID: ${context.projectId}
  Branch: ${context.branchName}
`;

	// Add suggestion based on error message
	if (
		error.message.includes('Invalid') ||
		error.message.includes('validation')
	) {
		output += `
**This looks like a validation error:**
  • Check the tool parameters
  • Refer to the tool documentation for valid inputs
  • Ensure required parameters are provided
`;
	}

	return output.trim();
}

/**
 * Format unknown error
 */
function formatUnknownError(toolName: string, error: unknown): string {
	return `${toolName} Failed

An unexpected error occurred: ${String(error)}

Please report this issue if it persists.
`;
}

/**
 * Extract a user-friendly message from an API error response
 *
 * @param response HTTP Response object
 * @returns Error message extracted from response
 */
export async function extractApiErrorMessage(
	response: Response,
): Promise<string> {
	try {
		// Try to parse as JSON first
		const contentType = response.headers.get('content-type');

		if (contentType?.includes('application/json')) {
			const json = await response.json();
			return json.error || json.message || response.statusText;
		}

		// Fall back to text
		const text = await response.text();
		return text || response.statusText;
	} catch {
		return response.statusText;
	}
}
