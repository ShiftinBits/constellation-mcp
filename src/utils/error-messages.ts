/**
 * Standard Error Messages Utility
 *
 * Provides consistent, helpful error messages across all MCP tools
 */

export const standardErrors = {
	/**
	 * Standard message when no data is found
	 * @param toolName - Name of the tool reporting the error
	 */
	noData: (toolName: string): string =>
		`No data found. This may indicate:\n` +
		`1. The project hasn't been indexed yet\n` +
		`2. The specified item doesn't exist\n` +
		`3. Project needs re-indexing\n\n` +
		`Try running: constellation index`,

	/**
	 * Standard message when data is incomplete or partially unavailable
	 * @param feature - Name of the feature that's missing data
	 */
	incompleteData: (feature: string): string =>
		`${feature} data is not available. This may indicate:\n` +
		`1. Feature not yet implemented in indexer\n` +
		`2. Project needs re-indexing with latest version\n` +
		`3. Project uses unsupported language features`,

	/**
	 * Standard message for parameter validation errors
	 * @param required - List of required parameters
	 * @param provided - List of provided parameters
	 */
	parameterMismatch: (required: string[], provided: string[]): string =>
		`Parameter mismatch:\n` +
		`Required: ${required.join(', ')}\n` +
		`Provided: ${provided.join(', ')}\n\n` +
		`Please check tool documentation.`,

	/**
	 * Standard message when a symbol cannot be found
	 * @param symbolIdentifier - The symbol name or ID that wasn't found
	 */
	symbolNotFound: (symbolIdentifier: string): string =>
		`Symbol not found: ${symbolIdentifier}\n\n` +
		`This may indicate:\n` +
		`1. The symbol doesn't exist in the project\n` +
		`2. The symbol name is misspelled\n` +
		`3. The project needs re-indexing\n\n` +
		`Try:\n` +
		`- Verifying the symbol name with search_symbols\n` +
		`- Re-indexing the project: constellation index`,

	/**
	 * Standard message when a file cannot be found
	 * @param filePath - The file path that wasn't found
	 */
	fileNotFound: (filePath: string): string =>
		`File not found: ${filePath}\n\n` +
		`This may indicate:\n` +
		`1. The file doesn't exist in the project\n` +
		`2. The file path is incorrect\n` +
		`3. The project needs re-indexing\n\n` +
		`Try:\n` +
		`- Verifying the file path exists\n` +
		`- Re-indexing the project: constellation index`,

	/**
	 * Standard message when a project cannot be found
	 * @param projectId - The project ID that wasn't found
	 */
	projectNotFound: (projectId: string): string =>
		`Project not found: ${projectId}\n\n` +
		`This may indicate:\n` +
		`1. The project hasn't been indexed yet\n` +
		`2. The project ID is incorrect\n` +
		`3. The project was deleted\n\n` +
		`Try running: constellation index`,

	/**
	 * Standard message for API errors
	 * @param endpoint - The API endpoint that failed
	 * @param statusCode - HTTP status code (optional)
	 * @param details - Additional error details (optional)
	 */
	apiError: (
		endpoint: string,
		statusCode?: number,
		details?: string,
	): string => {
		let message = `API Error: Failed to call ${endpoint}\n`;
		if (statusCode) {
			message += `Status Code: ${statusCode}\n`;
		}
		if (details) {
			message += `Details: ${details}\n`;
		}
		message += `\nThis may indicate:\n`;
		message += `1. Network connectivity issues\n`;
		message += `2. API service is down\n`;
		message += `3. Invalid request parameters\n\n`;
		message += `Try:\n`;
		message += `- Checking your network connection\n`;
		message += `- Verifying the API service is running\n`;
		message += `- Checking the constellation-core logs`;
		return message;
	},

	/**
	 * Standard message for empty results
	 * @param queryType - Type of query that returned empty results
	 */
	emptyResults: (queryType: string): string =>
		`No ${queryType} found.\n\n` +
		`This may indicate:\n` +
		`1. The query filters are too restrictive\n` +
		`2. No matching items exist in the project\n` +
		`3. The project needs re-indexing\n\n` +
		`Try:\n` +
		`- Broadening the search criteria\n` +
		`- Verifying the project has been indexed\n` +
		`- Re-indexing the project: constellation index`,

	/**
	 * Standard message for unsupported operations
	 * @param operation - Name of the unsupported operation
	 * @param reason - Reason why it's not supported (optional)
	 */
	unsupported: (operation: string, reason?: string): string => {
		let message = `Operation not supported: ${operation}\n`;
		if (reason) {
			message += `Reason: ${reason}\n`;
		}
		return message;
	},

	/**
	 * Standard message for configuration initialization errors
	 * @param errorDetails - Original error message
	 * @param workingDir - Working directory where config was searched (optional)
	 */
	configurationError: (errorDetails: string, workingDir?: string): string =>
		`⚠️ Configuration Error - Constellation MCP Server

I cannot execute this tool because constellation.json is not found in your git repository.

**How to fix this:**

1. Navigate to your git repository root directory
2. Initialize Constellation: \`constellation init\`
3. Set up authentication: \`constellation auth\`
4. Index your project: \`constellation index\`

**Need help?**
Documentation: https://docs.constellationdev.io/setup

**Technical details:**
${workingDir ? `Working directory: ${workingDir}\n` : ''}Error: ${errorDetails}
`,
};

/**
 * Helper to create user-friendly error messages from exceptions
 * @param error - The error object
 * @param context - Additional context about where the error occurred
 */
export function formatErrorMessage(error: any, context?: string): string {
	const errorMessage = error?.message || String(error);
	let message = '';

	if (context) {
		message += `Error in ${context}:\n`;
	}

	message += errorMessage;

	// Add stack trace in development
	if (process.env.NODE_ENV === 'development' && error?.stack) {
		message += `\n\nStack trace:\n${error.stack}`;
	}

	return message;
}
