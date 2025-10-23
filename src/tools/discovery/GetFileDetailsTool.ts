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
			type: z.coerce.boolean().optional(),
			description:
				'Include all symbols defined in the file (default: true)',
		},
		includeDependencies: {
			type: z.coerce.boolean().optional(),
			description:
				'Include files/modules this file depends on (default: true)',
		},
		includeDependents: {
			type: z.coerce.boolean().optional(),
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
		// Defensive checks
		if (!data || !data.file) {
			return 'Error: No file data returned from API';
		}

		const { file, symbols, dependencies, dependents } = data;

		// Backend returns 'path' not 'filePath'
		const filePath = file?.path || file?.filePath || 'unknown';
		let output = `File Details: ${filePath}\n\n`;

		// Basic info
		output += `Language: ${file?.language || 'unknown'}\n`;

		// Symbol counts from file metadata
		if (file?.symbolCounts && Object.keys(file.symbolCounts).length > 0) {
			const totalSymbols = Object.values(file.symbolCounts).reduce((a, b) => a + b, 0);
			output += `Symbols: ${totalSymbols}\n`;
			output += `Symbol Breakdown:\n`;
			for (const [kind, count] of Object.entries(file.symbolCounts)) {
				output += `  - ${kind}: ${count}\n`;
			}
		}

		// File characteristics
		if (file?.paradigm) {
			output += `Paradigm: ${file.paradigm}\n`;
		}
		if (file?.moduleType) {
			output += `Module Type: ${file.moduleType}\n`;
		}
		if (file?.domain) {
			output += `Domain: ${file.domain}\n`;
		}
		if (file?.isTest !== undefined) {
			output += `Is Test: ${file.isTest ? 'yes' : 'no'}\n`;
			if (file.testFramework) {
				output += `Test Framework: ${file.testFramework}\n`;
			}
		}

		// Metrics (if available)
		if (file?.metrics) {
			output += `\n## Metrics\n`;
			output += `Dependency Count: ${file.metrics.dependencyCount || 0}\n`;
			output += `Dependent Count: ${file.metrics.dependentCount || 0}\n`;
			output += `Dependency Depth: ${file.metrics.dependencyDepth || 0}\n`;
			if (file.metrics.linesOfCode) {
				output += `Lines of Code: ${file.metrics.linesOfCode}\n`;
			}
			if (file.metrics.complexityScore) {
				output += `Complexity Score: ${file.metrics.complexityScore.toFixed(2)}\n`;
			}
		}

		// Symbols
		if (symbols && symbols.length > 0) {
			output += `\n## Symbols (${symbols.length})\n\n`;
			output += formatSymbolList(symbols);
		}

		// Dependencies
		if (dependencies) {
			const directCount = dependencies.direct?.length || 0;
			const packageCount = dependencies.packages?.length || 0;

			if (directCount > 0) {
				output += `\n## File Dependencies (${directCount})\n\n`;
				for (const dep of dependencies.direct) {
					output += `→ ${dep?.filePath || 'unknown'}`;
					if (dep?.line) {
						output += ` (line ${dep.line})`;
					}
					output += '\n';
				}
			}

			if (packageCount > 0) {
				output += `\n## Package Dependencies (${packageCount})\n\n`;
				for (const pkg of dependencies.packages) {
					output += `→ ${pkg?.name || 'unknown'}`;
					if (pkg?.version) {
						output += ` @${pkg.version}`;
					}
					if (pkg?.type) {
						output += ` (${pkg.type})`;
					}
					output += '\n';
				}
			}
		}

		// Dependents
		if (dependents && dependents.length > 0) {
			output += `\n## Files Depending on This (${dependents.length})\n\n`;
			for (const dep of dependents) {
				output += `← ${dep}\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetFileDetailsTool;
