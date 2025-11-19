/**
 * Find Circular Dependencies Tool
 *
 * MCP tool for detecting circular dependency cycles in the codebase
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
import {
	FindCircularDependenciesParams,
	FindCircularDependenciesResult,
} from '../../types/api-types.js';
import { section, emphasize, keyValue, collapsedHint, numberedList } from '../../utils/format-helpers.js';
import { MARKERS } from '../../utils/semantic-markers.js';
import { booleanSchema } from '../../utils/schema-helpers.js';

class FindCircularDependenciesTool extends BaseMcpTool<
	FindCircularDependenciesParams,
	FindCircularDependenciesResult
> {
	name = 'find_circular_dependencies';
	description =
		'Detect circular dependency cycles in the codebase. Circular dependencies can cause issues with module loading, testing, and maintainability. ' +
		'**PAGINATION**: Supports limit/offset with default of 50. Use for codebases with many circular dependencies. ' +
		'Increase limit (75-100) for comprehensive circular dependency analysis across large projects.';

	schema = {
		filePath: {
			type: z.string().optional(),
			description:
				'Optional: Start search from a specific file to find cycles involving it',
		},
		minCycleLength: {
			type: z.coerce.number().int().min(2).max(10).optional().default(2),
			description:
				'Minimum cycle length to detect (default: 2, max: 10)',
		},
		includeDetails: {
			type: booleanSchema.optional().default(true),
			description: 'Include detailed cycle information (default: true)',
		},
		includeConfidence: {
			type: booleanSchema.optional().default(false),
			description: 'Include confidence scores (default: false)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(50),
			description:
				'Maximum number of cycles to return per page (default: 50, max: 100). Use 75-100 for large projects to see comprehensive cycle detection in fewer requests.',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Starting position for pagination (default: 0). Increment by limit for next page. Example: limit=50, offset=50 gets cycles 51-100.',
		},
	};

	/**
	 * Format the circular dependencies for AI-friendly output
	 */
	protected formatResult(
		data: FindCircularDependenciesResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { cycles, totalCycles } = data;
		const cyclesArray = cycles || [];
		const total = totalCycles || 0;

		let output = `${section('Circular Dependencies Analysis', 1)}\n\n`;

		if (total === 0 || cyclesArray.length === 0) {
			output += `${MARKERS.SAFE} No circular dependencies found! Your codebase has a clean dependency graph.`;
		} else {
			output += `${MARKERS.CIRCULAR} Found ${total} circular ${total === 1 ? 'dependency' : 'dependencies'}\n\n`;

			// Sort by cycle length (shortest first, as they're usually more problematic)
			const sortedCycles = [...cyclesArray].sort((a, b) => (a?.length || 0) - (b?.length || 0));

			for (let i = 0; i < Math.min(sortedCycles.length, 10); i++) {
				const cycle = sortedCycles[i];
				const cycleFiles = cycle?.cycle || [];
				const cycleLength = cycle?.length || cycleFiles.length;

				output += `${section(`Cycle ${i + 1} (length: ${cycleLength})`, 3)}\n`;

				for (let j = 0; j < cycleFiles.length; j++) {
					const file = cycleFiles[j];
					output += `  ${file}\n`;
					output += `    ↓ depends on\n`;
				}
				// Close the cycle
				if (cycleFiles.length > 0) {
					output += `  ${cycleFiles[0]} (completes cycle)\n\n`;
				}
			}

			if (total > 10) {
				output += `\n${collapsedHint(total, 10)}\n`;
			}

			const fixes = [
				'Extract shared code into a separate module',
				'Use dependency injection to break the cycle',
				'Refactor to use interfaces/abstractions',
				'Move one dependency to a parent module',
			];
			output += `\n${emphasize('How to fix')}:\n${numberedList(fixes)}\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default FindCircularDependenciesTool;
