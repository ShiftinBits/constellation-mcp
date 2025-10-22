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
			type: z.number().int().min(2).max(10).optional().default(5),
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
		const { cycles, totalCycles } = data;

		let output = `Circular Dependencies Analysis\n\n`;

		if (totalCycles === 0) {
			output += '✅ No circular dependencies found! Your codebase has a clean dependency graph.';
		} else {
			output += `⚠️  Found ${totalCycles} circular ${totalCycles === 1 ? 'dependency' : 'dependencies'}\n\n`;

			// Sort by cycle length (shortest first, as they're usually more problematic)
			const sortedCycles = [...cycles].sort((a, b) => a.length - b.length);

			for (let i = 0; i < Math.min(sortedCycles.length, 10); i++) {
				const cycle = sortedCycles[i];
				output += `## Cycle ${i + 1} (length: ${cycle.length})\n`;

				for (let j = 0; j < cycle.cycle.length; j++) {
					const file = cycle.cycle[j];
					const nextFile = cycle.cycle[(j + 1) % cycle.cycle.length];
					output += `  ${file}\n`;
					output += `    ↓ depends on\n`;
				}
				// Close the cycle
				output += `  ${cycle.cycle[0]} (completes cycle)\n\n`;
			}

			if (totalCycles > 10) {
				output += `\n... and ${totalCycles - 10} more cycles\n`;
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
