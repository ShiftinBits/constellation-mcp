/**
 * Get File Details Tool
 *
 * MCP tool for getting detailed information about a specific file including
 * all its symbols, dependencies, dependents, and statistics
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	GetFileDetailsParams,
	GetFileDetailsResult,
} from '../../types/api-types.js';
import {
	formatSymbolList,
	formatDependencies,
	formatBytes,
} from '../../utils/format-helpers.js';

class GetFileDetailsTool extends BaseMcpTool<
	GetFileDetailsParams,
	GetFileDetailsResult
> {
	name = 'get_file_details';
	description =
		'Get detailed information about a specific file including all symbols defined in it, its dependencies, dependents, and file statistics.';

	schema = {
		filePath: {
			type: z.string().min(1),
			description:
				'Path to the file (relative to project root, e.g., "src/components/Button.tsx")',
		},
		includeSymbols: {
			type: z.boolean().optional(),
			description:
				'Include all symbols defined in the file (default: true)',
		},
		includeDependencies: {
			type: z.boolean().optional(),
			description:
				'Include files/modules this file depends on (default: true)',
		},
		includeDependents: {
			type: z.boolean().optional(),
			description:
				'Include files that depend on this file (default: true)',
		},
	};

	/**
	 * Format the file details for AI-friendly output
	 */
	protected formatResult(
		data: GetFileDetailsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { file } = data;
		let output = `File Details: ${file.filePath}\n\n`;

		// Basic info
		output += `Language: ${file.language}\n`;

		if (file.stats) {
			output += `Size: ${formatBytes(file.stats.size)}\n`;
			output += `Symbols: ${file.stats.symbolCount}\n`;
			if (file.stats.lastModified) {
				output += `Last Modified: ${file.stats.lastModified}\n`;
			}
		}

		// Symbols
		if (file.symbols && file.symbols.length > 0) {
			output += `\n## Symbols (${file.symbols.length})\n\n`;
			output += formatSymbolList(file.symbols);
		}

		// Dependencies
		if (file.dependencies && file.dependencies.length > 0) {
			output += `\n\n## Dependencies (${file.dependencies.length})\n`;
			output += formatDependencies(file.dependencies);
		}

		// Dependents
		if (file.dependents && file.dependents.length > 0) {
			output += `\n\n## Dependents (${file.dependents.length})\n`;
			output += formatDependencies(file.dependents);
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetFileDetailsTool;
