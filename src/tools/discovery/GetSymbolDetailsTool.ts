/**
 * Get Symbol Details Tool
 *
 * MCP tool for getting detailed information about a specific symbol including
 * its definition, dependencies, dependents, and usage locations
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	GetSymbolDetailsParams,
	GetSymbolDetailsResult,
} from '../../types/api-types.js';
import {
	formatLocation,
	formatDependencies,
} from '../../utils/format-helpers.js';

class GetSymbolDetailsTool extends BaseMcpTool<
	GetSymbolDetailsParams,
	GetSymbolDetailsResult
> {
	name = 'get_symbol_details';
	description =
		'Get detailed information about a specific symbol (function, class, variable, etc.) including its signature, documentation, dependencies, dependents, and all usage locations.';

	schema = {
		symbolId: {
			type: z.string().optional(),
			description:
				'Unique symbol identifier (from search results)',
		},
		symbolName: {
			type: z.string().optional(),
			description: 'Symbol name to look up',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'File path to narrow down search (required if symbolName is ambiguous)',
		},
		includeDependencies: {
			type: z.boolean().optional(),
			description:
				'Include what this symbol depends on (default: true)',
		},
		includeDependents: {
			type: z.boolean().optional(),
			description:
				'Include what depends on this symbol (default: true)',
		},
		includeUsages: {
			type: z.boolean().optional(),
			description:
				'Include all locations where this symbol is used (default: true)',
		},
	};

	/**
	 * Format the symbol details for AI-friendly output
	 */
	protected formatResult(
		data: GetSymbolDetailsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { symbol } = data;
		let output = `Symbol Details: ${symbol.name}\n\n`;

		// Basic info
		output += `Type: ${symbol.kind}\n`;
		output += `Location: ${formatLocation(symbol.filePath, symbol.line, symbol.column)}\n`;

		if (symbol.qualifiedName && symbol.qualifiedName !== symbol.name) {
			output += `Qualified Name: ${symbol.qualifiedName}\n`;
		}

		if (symbol.signature) {
			output += `Signature: ${symbol.signature}\n`;
		}

		if (symbol.visibility) {
			output += `Visibility: ${symbol.visibility}\n`;
		}

		output += `Exported: ${symbol.isExported ? 'yes' : 'no'}\n`;

		if (symbol.documentation) {
			output += `\nDocumentation:\n${symbol.documentation}\n`;
		}

		// Dependencies
		if (symbol.dependencies && symbol.dependencies.length > 0) {
			output += `\n## Dependencies (${symbol.dependencies.length})\n`;
			output += formatDependencies(symbol.dependencies);
		}

		// Dependents
		if (symbol.dependents && symbol.dependents.length > 0) {
			output += `\n\n## Dependents (${symbol.dependents.length})\n`;
			output += formatDependencies(symbol.dependents);
		}

		// Usages
		if (symbol.usages && symbol.usages.length > 0) {
			output += `\n\n## Usages (${symbol.usages.length} locations)\n`;
			for (const usage of symbol.usages.slice(0, 20)) {
				output += `  ${formatLocation(usage.filePath, usage.line)}\n`;
			}
			if (symbol.usages.length > 20) {
				output += `  ... and ${symbol.usages.length - 20} more\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetSymbolDetailsTool;
