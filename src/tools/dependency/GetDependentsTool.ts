/**
 * Get Dependents Tool
 *
 * MCP tool for finding what depends on a file or symbol (inverse dependencies)
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	GetDependentsParams,
	GetDependentsResult,
} from '../../types/api-types.js';
import { formatDependencies } from '../../utils/format-helpers.js';

class GetDependentsTool extends BaseMcpTool<
	GetDependentsParams,
	GetDependentsResult
> {
	name = 'get_dependents';
	description =
		'Find what depends on a file or symbol (inverse dependencies). Shows which files import or use the target to understand impact of changes.';

	schema = {
		filePath: {
			type: z.string().optional(),
			description:
				'File path to analyze (e.g., "src/utils/helpers.ts")',
		},
		symbolId: {
			type: z.string().optional(),
			description:
				'Symbol ID to analyze (alternative to filePath)',
		},
		depth: {
			type: z.number().int().min(1).max(5).optional().default(1),
			description:
				'How many levels deep to traverse dependents (default: 1, max: 5)',
		},
	};

	/**
	 * Format the dependents for AI-friendly output
	 */
	protected formatResult(
		data: GetDependentsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { dependents, totalCount } = data;

		let output = `Dependents Analysis\n\n`;
		output += `Total: ${totalCount} ${totalCount === 1 ? 'dependent' : 'dependents'}\n\n`;

		if (dependents.length === 0) {
			output += 'No dependents found. This file/symbol is not used anywhere (may be orphaned code).';
		} else {
			// Group by usage count if available
			const withUsageCount = dependents.filter((d) => d.usageCount);
			const withoutUsageCount = dependents.filter((d) => !d.usageCount);

			if (withUsageCount.length > 0) {
				// Sort by usage count descending
				withUsageCount.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

				output += '## Most Frequently Used By:\n';
				for (const dep of withUsageCount.slice(0, 10)) {
					output += `→ ${dep.source}`;
					if (dep.type !== 'dependency') {
						output += ` (${dep.type})`;
					}
					output += ` - ${dep.usageCount} ${dep.usageCount === 1 ? 'usage' : 'usages'}\n`;
				}

				if (withUsageCount.length > 10) {
					output += `\n... and ${withUsageCount.length - 10} more files\n`;
				}
			}

			if (withoutUsageCount.length > 0) {
				if (withUsageCount.length > 0) {
					output += '\n## Other Dependents:\n';
				}
				output += formatDependencies(withoutUsageCount.slice(0, 20));

				if (withoutUsageCount.length > 20) {
					output += `\n... and ${withoutUsageCount.length - 20} more\n`;
				}
			}

			if (dependents.length < totalCount) {
				output += `\n(Showing ${dependents.length} of ${totalCount} dependents)`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetDependentsTool;
