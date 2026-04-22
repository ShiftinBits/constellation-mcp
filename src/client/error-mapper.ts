/**
 * Error Mapper - Converts API errors into helpful, actionable messages
 *
 * Maps HTTP errors and API responses into user-friendly guidance
 */

import { configCache } from '../config/config-cache.js';
import { standardErrors } from '../utils/error-messages.js';
import {
	AuthenticationError,
	NotFoundError,
	ToolNotFoundError,
} from './constellation-client.js';
import { DOCS_URLS } from '../constants/urls.js';

/**
 * Get project context, preferring the provided context over config cache
 */
function getProjectContext(context?: {
	projectId: string;
	branchName: string;
}): { projectId: string; branchName: string } {
	if (context) {
		return context;
	}
	const config = configCache.getDefaultConfig();
	return {
		projectId: config?.projectId ?? 'unknown',
		branchName: config?.branchName ?? 'unknown',
	};
}

/**
 * Map an error to a helpful message with actionable guidance
 *
 * @param error Error object
 * @param toolName Name of the tool that failed
 * @param context Optional project context to use instead of config cache
 * @returns Helpful error message with guidance
 */
export function mapErrorToMessage(
	error: unknown,
	toolName: string,
	context?: { projectId: string; branchName: string },
): string {
	// Handle known error types
	if (error instanceof AuthenticationError) {
		return formatAuthenticationError();
	}

	if (error instanceof NotFoundError) {
		return formatNotFoundError(toolName, context);
	}

	if (error instanceof ToolNotFoundError) {
		return formatToolNotFoundError(error.message);
	}

	// Handle generic Error objects
	if (error instanceof Error) {
		return formatGenericError(toolName, error, context);
	}

	// Handle unknown error types
	return formatUnknownError(toolName, error);
}

/**
 * Format authentication error with helpful guidance
 */
function formatAuthenticationError(): string {
	const context = getProjectContext();

	return `Authentication Failed

The Constellation API rejected your access key.

**How to fix this:**

Set up authentication using the CLI:
\`constellation auth\`

This will configure your API key properly.

For more information, visit: ${DOCS_URLS.root}
`;
}

/**
 * Format not found error (project not indexed)
 */
function formatNotFoundError(
	toolName: string,
	providedContext?: { projectId: string; branchName: string },
): string {
	const context = getProjectContext(providedContext);

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

For more information, visit: ${DOCS_URLS.gettingStarted}
`;
}

/**
 * Format tool not found error
 */
function formatToolNotFoundError(message: string): string {
	return `Tool Not Found

${message}

**Available API methods (via api object):**
  • Discovery: api.searchSymbols(), api.getSymbolDetails()
  • Dependencies: api.getDependencies(), api.getDependents(), api.findCircularDependencies()
  • Usage: api.traceSymbolUsage(), api.getCallGraph()
  • Impact: api.impactAnalysis(), api.findOrphanedCode()
  • Architecture: api.getArchitectureOverview()

**To see all available methods:**
  Run api.listMethods() inside code_intel

For more information, visit: ${DOCS_URLS.tools}
`;
}

/**
 * Format generic error with context
 */
function formatGenericError(
	toolName: string,
	error: Error,
	providedContext?: { projectId: string; branchName: string },
): string {
	const context = getProjectContext(providedContext);

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
