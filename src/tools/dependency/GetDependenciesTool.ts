/**
 * Get Dependencies Tool
 *
 * MCP tool for finding what a file or symbol depends on
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	GetDependenciesParams,
	GetDependenciesResult,
} from '../../types/api-types.js';
import { formatDependencies } from '../../utils/format-helpers.js';

class GetDependenciesTool extends BaseMcpTool<
	GetDependenciesParams,
	GetDependenciesResult
> {
	name = 'get_dependencies';
	description =
		'Find what a file or symbol depends on. Shows imports, function calls, and references to understand what the target relies on.';

	schema = {
		filePath: {
			type: z.string().optional(),
			description:
				'File path to analyze (e.g., "src/components/Button.tsx")',
		},
		symbolId: {
			type: z.string().optional(),
			description:
				'Symbol ID to analyze (alternative to filePath)',
		},
		depth: {
			type: z.number().int().min(1).max(5).optional().default(1),
			description:
				'How many levels deep to traverse dependencies (default: 1, max: 5)',
		},
		includeExternal: {
			type: z.boolean().optional().default(false),
			description:
				'Include external package dependencies (default: false)',
		},
	};

	/**
	 * Format the dependencies for AI-friendly output
	 */
	protected formatResult(
		data: GetDependenciesResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { dependencies, totalCount } = data;

		let output = `Dependencies Analysis\n\n`;
		output += `Total: ${totalCount} ${totalCount === 1 ? 'dependency' : 'dependencies'}\n\n`;

		if (dependencies.length === 0) {
			output += 'No dependencies found. This file/symbol is independent.';
		} else {
			output += formatDependencies(dependencies);

			if (dependencies.length < totalCount) {
				output += `\n\n(Showing ${dependencies.length} of ${totalCount} dependencies)`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetDependenciesTool;
