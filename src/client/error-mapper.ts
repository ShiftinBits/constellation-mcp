/**
 * Error Mapper - Converts API errors into helpful, actionable messages
 *
 * Maps HTTP errors and API responses into user-friendly guidance
 */

import {
	AuthenticationError,
	NotFoundError,
	ToolNotFoundError,
} from './constellation-client.js';
import { getConfigContext } from '../config/config-manager.js';

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

	return `❌ Authentication Failed

The Constellation API rejected your access key.

**To fix this:**
1. Set the CONSTELLATION_API_KEY environment variable
2. Get your API key from your Constellation administrator
3. Verify the API URL is correct: ${context.config.apiUrl}

**Example:**
export CONSTELLATION_API_KEY="your-api-key-here"

For more information, visit: https://docs.constellation.dev/authentication
`;
}

/**
 * Format not found error (project not indexed)
 */
function formatNotFoundError(toolName: string): string {
	const context = getConfigContext();

	return `❌ Project Not Indexed

The tool "${toolName}" cannot find your project in the Constellation index.

**Project Details:**
  API: ${context.config.apiUrl}
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

For more information, visit: https://docs.constellation.dev/getting-started
`;
}

/**
 * Format tool not found error
 */
function formatToolNotFoundError(message: string): string {
	return `❌ Tool Not Found

${message}

**Available tool categories:**
  • Discovery tools: search_symbols, search_files, get_symbol_details, get_file_details
  • Dependency tools: get_dependencies, get_dependents, find_circular_dependencies
  • Impact tools: analyze_change_impact, analyze_breaking_changes, find_orphaned_code
  • Architecture tools: get_architecture_overview, detect_architecture_violations
  • Refactoring tools: find_similar_patterns, find_entry_points

**To see all available tools:**
  Query the tool catalog through the MCP interface or API

For more information, visit: https://docs.constellation.dev/tools
`;
}

/**
 * Format generic error with context
 */
function formatGenericError(toolName: string, error: Error): string {
	const context = getConfigContext();

	let output = `❌ ${toolName} Failed

${error.message}

**Context:**
  API: ${context.config.apiUrl}
  Project ID: ${context.projectId}
  Branch: ${context.branchName}
`;

	// Add suggestion based on error message
	if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
		output += `
**This looks like a network error:**
  • Is the Constellation API server running?
  • Can you reach ${context.config.apiUrl}?
  • Check your network connection
  • Verify firewall settings
`;
	} else if (error.message.includes('timeout')) {
		output += `
**This looks like a timeout:**
  • The API server may be overloaded
  • Try again in a moment
  • Consider indexing a smaller subset of files
`;
	} else if (error.message.includes('Invalid') || error.message.includes('validation')) {
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
	return `❌ ${toolName} Failed

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
	response: Response
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
