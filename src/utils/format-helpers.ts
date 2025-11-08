/**
 * Response formatting utilities for AI-friendly output
 *
 * Converts API JSON responses into human-readable text optimized for AI consumption
 */

/**
 * Format a file location with line numbers for easy navigation
 *
 * @param filePath File path
 * @param line Line number (optional)
 * @param column Column number (optional)
 * @returns Formatted location string (e.g., "src/utils/file.ts:42" or "src/utils/file.ts:42:15")
 */
export function formatLocation(
	filePath: string,
	line?: number,
	column?: number
): string {
	if (line !== undefined && column !== undefined) {
		return `${filePath}:${line}:${column}`;
	} else if (line !== undefined) {
		return `${filePath}:${line}`;
	}
	return filePath;
}

/**
 * Format a symbol with its location for display
 *
 * @param name Symbol name
 * @param kind Symbol kind (function, class, etc.)
 * @param filePath File path
 * @param line Line number (optional)
 * @returns Formatted symbol string
 */
export function formatSymbol(
	name: string,
	kind: string,
	filePath: string,
	line?: number
): string {
	const location = formatLocation(filePath, line);
	return `${name} (${kind})\n  Location: ${location}`;
}

/**
 * Format a list of symbols with pagination info
 *
 * @param symbols Array of symbols
 * @param pagination Pagination metadata
 * @returns Formatted string with symbols and pagination info
 */
export function formatSymbolList(
	symbols: any[],
	pagination?: { total: number; returned: number; hasMore: boolean }
): string {
	if (!symbols || symbols.length === 0) {
		return 'No symbols found.';
	}

	let output = pagination
		? `Found ${pagination.total} symbol${pagination.total === 1 ? '' : 's'}:\n\n`
		: `Found ${symbols.length} symbol${symbols.length === 1 ? '' : 's'}:\n\n`;

	for (const symbol of symbols) {
		const name = symbol?.name || 'unknown';
		const kind = symbol?.kind || 'unknown';
		output += `${name} (${kind})\n`;
		output += `  Location: ${formatLocation(symbol?.filePath || 'unknown', symbol?.line)}\n`;

		if (symbol?.qualifiedName && symbol.qualifiedName !== symbol.name) {
			output += `  Qualified: ${symbol.qualifiedName}\n`;
		}

		if (symbol?.signature) {
			output += `  Signature: ${symbol.signature}\n`;
		}

		if (symbol?.visibility) {
			output += `  Visibility: ${symbol.visibility}\n`;
		}

		if (symbol?.isExported !== undefined) {
			output += `  Exported: ${symbol.isExported ? 'yes' : 'no'}\n`;
		}

		if (symbol?.usageCount !== undefined) {
			output += `  Used in: ${symbol.usageCount} place${symbol.usageCount === 1 ? '' : 's'}\n`;
		}

		if (symbol?.documentation) {
			output += `  Docs: ${symbol.documentation}\n`;
		}

		output += '\n';
	}

	if (pagination?.hasMore) {
		const remaining = pagination.total - pagination.returned;
		output += `\n(${remaining} more result${remaining === 1 ? '' : 's'} available)\n`;
	}

	return output.trim();
}

/**
 * Format a list of files with metadata
 *
 * @param files Array of files
 * @param pagination Pagination metadata
 * @returns Formatted string with files and pagination info
 */
export function formatFileList(
	files: any[],
	pagination?: { total: number; returned: number; hasMore: boolean }
): string {
	if (!files || files.length === 0) {
		return 'No files found.';
	}

	let output = pagination
		? `Found ${pagination.total} file${pagination.total === 1 ? '' : 's'}:\n\n`
		: `Found ${files.length} file${files.length === 1 ? '' : 's'}:\n\n`;

	for (const file of files) {
		// Backend returns 'path' not 'filePath' - use defensive access
		const filePath = file?.path || file?.filePath || 'unknown';
		output += `${filePath}\n`;

		if (file?.symbolCount !== undefined) {
			output += `  Symbols: ${file.symbolCount}\n`;
		}

		if (file?.language) {
			output += `  Language: ${file.language}\n`;
		}

		if (file?.size !== undefined) {
			output += `  Size: ${formatBytes(file.size)}\n`;
		}

		output += '\n';
	}

	if (pagination?.hasMore) {
		const remaining = pagination.total - pagination.returned;
		output += `\n(${remaining} more result${remaining === 1 ? '' : 's'} available)\n`;
	}

	return output.trim();
}

/**
 * Format bytes into human-readable size
 *
 * @param bytes Number of bytes
 * @returns Formatted size string (e.g., "1.5 KB", "2.3 MB")
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format a dependency tree or graph
 *
 * @param dependencies Array of dependencies
 * @returns Formatted dependency tree
 */
export function formatDependencies(dependencies: any[]): string {
	if (!dependencies || dependencies.length === 0) {
		return 'No dependencies found.';
	}

	let output = `Found ${dependencies.length} ${dependencies.length === 1 ? 'dependency' : 'dependencies'}:\n\n`;

	for (const dep of dependencies) {
		const target = dep?.target || dep?.to || dep?.targetFile || dep?.filePath || 'unknown';
		const type = dep?.type || dep?.dependencyType || 'dependency';

		output += `→ ${target}`;

		if (type !== 'dependency') {
			output += ` (${type})`;
		}

		if (dep?.line) {
			output += ` at line ${dep.line}`;
		}

		output += '\n';
	}

	return output.trim();
}

/**
 * Format an error message with helpful guidance
 *
 * @param toolName Name of the tool that failed
 * @param error Error message
 * @param suggestion Optional suggestion for fixing the error
 * @returns Formatted error message
 */
export function formatError(
	toolName: string,
	error: string,
	suggestion?: string
): string {
	let output = `${toolName} failed\n\n`;
	output += `Error: ${error}\n`;

	if (suggestion) {
		output += `\nSuggestion: ${suggestion}\n`;
	}

	return output;
}

/**
 * Truncate text to a maximum length with ellipsis
 *
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @returns Truncated text
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.slice(0, maxLength - 3) + '...';
}

/**
 * Pluralize a word based on count
 *
 * @param count Number to check
 * @param singular Singular form
 * @param plural Plural form (optional, defaults to singular + 's')
 * @returns Pluralized word
 */
export function pluralize(
	count: number,
	singular: string,
	plural?: string
): string {
	if (count === 1) {
		return singular;
	}
	return plural || `${singular}s`;
}
