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
				'File path to analyze dependents for (e.g., "src/utils/helpers.ts"). Required if symbolId not provided.',
		},
		symbolId: {
			type: z.string().optional(),
			description:
				'Symbol ID to analyze (alternative to filePath + symbolName)',
		},
		symbolName: {
			type: z.string().optional(),
			description:
				'Symbol name when analyzing a specific symbol (optional, use with filePath)',
		},
		depth: {
			type: z.coerce.number().int().min(1).max(5).optional().default(1),
			description:
				'How many levels deep to traverse dependents (default: 1, max: 5)',
		},
	};

	/**
	 * Override execute to generate symbolId from filePath + symbolName if needed
	 */
	async execute(input: GetDependentsParams & { symbolName?: string }): Promise<string> {
		// If symbolName provided with filePath but no symbolId, generate it
		if (!input.symbolId && input.filePath && input.symbolName) {
			input.symbolId = this.generateSymbolId(input.filePath, input.symbolName);
		}

		// Validate that we have either filePath or symbolId
		if (!input.filePath && !input.symbolId) {
			return 'Error: Either filePath or symbolId (or filePath + symbolName) must be provided';
		}

		return super.execute(input);
	}

	/**
	 * Format the dependents for AI-friendly output
	 */
	protected formatResult(
		data: GetDependentsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { file, directDependents, transitiveDependents, detailedMetrics } = data;

		let output = `Dependents Analysis\n\n`;
		output += `File: ${file || 'unknown'}\n\n`;

		// Direct dependents
		const directCount = directDependents?.length || 0;
		if (directCount > 0) {
			output += `## Direct Dependents (${directCount})\n\n`;
			for (const dep of directDependents!) {
				output += `← ${dep?.filePath || 'unknown'}`;
				if (dep?.usedSymbols && dep.usedSymbols.length > 0) {
					output += `\n  Uses: ${dep.usedSymbols.join(', ')}`;
				}
				output += '\n';
			}
		}

		// Transitive dependents
		const transitiveCount = transitiveDependents?.length || 0;
		if (transitiveCount > 0) {
			output += `\n## Transitive Dependents (${transitiveCount})\n\n`;
			for (const dep of transitiveDependents!.slice(0, 20)) {
				output += `← ${dep?.filePath || 'unknown'}`;
				if (dep?.distance !== undefined) {
					output += ` (distance: ${dep.distance})`;
				}
				if (dep?.path && dep.path.length > 0) {
					output += `\n  Path: ${dep.path.join(' ← ')}`;
				}
				output += '\n';
			}
			if (transitiveCount > 20) {
				output += `\n... and ${transitiveCount - 20} more\n`;
			}
		}

		// Detailed metrics
		if (detailedMetrics) {
			output += `\n## Detailed Metrics\n`;

			if (detailedMetrics.byDepth && Object.keys(detailedMetrics.byDepth).length > 0) {
				output += `\n### By Depth\n`;
				for (const [depth, count] of Object.entries(detailedMetrics.byDepth)) {
					output += `  Depth ${depth}: ${count} file${count === 1 ? '' : 's'}\n`;
				}
			}

			if (detailedMetrics.criticalPaths && detailedMetrics.criticalPaths.length > 0) {
				output += `\n### Critical Impact Paths\n`;
				for (const path of detailedMetrics.criticalPaths.slice(0, 5)) {
					output += `  ${path.join(' → ')}\n`;
				}
				if (detailedMetrics.criticalPaths.length > 5) {
					output += `  ... and ${detailedMetrics.criticalPaths.length - 5} more\n`;
				}
			}

			if (detailedMetrics.mostImpactedFiles && detailedMetrics.mostImpactedFiles.length > 0) {
				output += `\n### Most Impacted Files\n`;
				for (const file of detailedMetrics.mostImpactedFiles.slice(0, 5)) {
					output += `  • ${file}\n`;
				}
			}
		}

		// Summary
		if (directCount === 0 && transitiveCount === 0) {
			output += 'No dependents found. This file is not used anywhere (may be orphaned code).\n';
		} else {
			output += `\n## Summary\n`;
			output += `Direct: ${directCount}\n`;
			if (transitiveCount > 0) {
				output += `Transitive: ${transitiveCount}\n`;
			}
			const totalCount = directCount + transitiveCount;
			output += `Total Impact: ${totalCount} file${totalCount === 1 ? '' : 's'}\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetDependentsTool;
