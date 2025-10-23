/**
 * Find Circular Dependencies Tool
 *
 * MCP tool for detecting circular dependency cycles in the codebase
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	FindCircularDependenciesParams,
	FindCircularDependenciesResult,
} from '../../types/api-types.js';

class FindCircularDependenciesTool extends BaseMcpTool<
	FindCircularDependenciesParams,
	FindCircularDependenciesResult
> {
	name = 'find_circular_dependencies';
	description =
		'Detect circular dependency cycles in the codebase. Circular dependencies can cause issues with module loading, testing, and maintainability.';

	schema = {
		filePath: {
			type: z.string().optional(),
			description:
				'Optional: Start search from a specific file to find cycles involving it',
		},
		maxDepth: {
			type: z.coerce.number().int().min(2).max(10).optional().default(5),
			description:
				'Maximum cycle depth to search for (default: 5, max: 10)',
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

		let output = `Circular Dependencies Analysis\n\n`;

		if (total === 0 || cyclesArray.length === 0) {
			output += '✅ No circular dependencies found! Your codebase has a clean dependency graph.';
		} else {
			output += `⚠️  Found ${total} circular ${total === 1 ? 'dependency' : 'dependencies'}\n\n`;

			// Sort by cycle length (shortest first, as they're usually more problematic)
			const sortedCycles = [...cyclesArray].sort((a, b) => (a?.length || 0) - (b?.length || 0));

			for (let i = 0; i < Math.min(sortedCycles.length, 10); i++) {
				const cycle = sortedCycles[i];
				const cycleFiles = cycle?.cycle || [];
				const cycleLength = cycle?.length || cycleFiles.length;

				output += `## Cycle ${i + 1} (length: ${cycleLength})\n`;

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
				output += `\n... and ${total - 10} more cycles\n`;
			}

			output += '\n💡 **How to fix:**\n';
			output += '1. Extract shared code into a separate module\n';
			output += '2. Use dependency injection to break the cycle\n';
			output += '3. Refactor to use interfaces/abstractions\n';
			output += '4. Move one dependency to a parent module\n';
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default FindCircularDependenciesTool;
