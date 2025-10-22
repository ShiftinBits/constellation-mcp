/**
 * Compare Modules Tool
 *
 * MCP tool for comparing two modules to understand their similarities, differences, and relationships
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface CompareModulesParams {
	module1: string;
	module2: string;
	compareStructure?: boolean;
	compareDependencies?: boolean;
	compareApi?: boolean;
}

interface ModuleComparison {
	structure: {
		fileCountDiff: number;
		symbolCountDiff: number;
		locDiff: number;
		similarities: string[];
		differences: string[];
	};
	dependencies: {
		sharedInternal: string[];
		sharedExternal: string[];
		uniqueToModule1: string[];
		uniqueToModule2: string[];
		crossDependencies: Array<{
			from: string;
			to: string;
			type: string;
		}>;
	};
	api: {
		similarExports: Array<{
			name: string;
			inModule1: boolean;
			inModule2: boolean;
			identical: boolean;
		}>;
		uniqueToModule1: string[];
		uniqueToModule2: string[];
	};
	analysis: {
		similarity: number;
		relationship:
			| 'independent'
			| 'parent-child'
			| 'siblings'
			| 'circular'
			| 'tightly-coupled';
		recommendations: string[];
	};
}

interface CompareModulesResult {
	modules: {
		module1: {
			name: string;
			path: string;
			files: number;
			symbols: number;
		};
		module2: {
			name: string;
			path: string;
			files: number;
			symbols: number;
		};
	};
	comparison: ModuleComparison;
}

class CompareModulesTool extends BaseMcpTool<
	CompareModulesParams,
	CompareModulesResult
> {
	name = 'compare_modules';
	description =
		'Compare two modules to understand their similarities, differences, dependencies, and relationships. Useful for refactoring and consolidation decisions.';

	schema = {
		module1: {
			type: z.string().min(1),
			description: 'Path to first module (e.g., "src/services/auth")',
		},
		module2: {
			type: z.string().min(1),
			description: 'Path to second module (e.g., "src/services/users")',
		},
		compareStructure: {
			type: z.boolean().optional().default(true),
			description:
				'Compare module structure and organization (default: true)',
		},
		compareDependencies: {
			type: z.boolean().optional().default(true),
			description: 'Compare dependencies (default: true)',
		},
		compareApi: {
			type: z.boolean().optional().default(true),
			description: 'Compare exported APIs (default: true)',
		},
	};

	/**
	 * Format the module comparison for AI-friendly output
	 */
	protected formatResult(
		data: CompareModulesResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { modules, comparison } = data;

		let output = `Module Comparison\n\n`;

		// Module info
		output += `## Modules\n\n`;
		output += `**Module 1:** ${modules.module1.name}\n`;
		output += `  Path: ${modules.module1.path}\n`;
		output += `  Files: ${modules.module1.files}\n`;
		output += `  Symbols: ${modules.module1.symbols}\n\n`;

		output += `**Module 2:** ${modules.module2.name}\n`;
		output += `  Path: ${modules.module2.path}\n`;
		output += `  Files: ${modules.module2.files}\n`;
		output += `  Symbols: ${modules.module2.symbols}\n\n`;

		// Analysis summary
		output += `## Analysis\n`;
		output += `Similarity: ${comparison.analysis.similarity}%\n`;
		output += `Relationship: ${comparison.analysis.relationship}\n\n`;

		// Structure comparison
		if (comparison.structure) {
			output += `## Structure Comparison\n\n`;

			const fileDiff = comparison.structure.fileCountDiff;
			const symbolDiff = comparison.structure.symbolCountDiff;
			const locDiff = comparison.structure.locDiff;

			if (fileDiff !== 0) {
				const larger = fileDiff > 0 ? 'Module 1' : 'Module 2';
				output += `${larger} has ${Math.abs(fileDiff)} more files\n`;
			}
			if (symbolDiff !== 0) {
				const larger = symbolDiff > 0 ? 'Module 1' : 'Module 2';
				output += `${larger} has ${Math.abs(symbolDiff)} more symbols\n`;
			}
			if (locDiff !== 0) {
				const larger = locDiff > 0 ? 'Module 1' : 'Module 2';
				output += `${larger} has ${Math.abs(locDiff)} more lines of code\n`;
			}

			if (comparison.structure.similarities.length > 0) {
				output += `\n### Similarities\n`;
				for (const sim of comparison.structure.similarities) {
					output += `  ✓ ${sim}\n`;
				}
			}

			if (comparison.structure.differences.length > 0) {
				output += `\n### Differences\n`;
				for (const diff of comparison.structure.differences) {
					output += `  • ${diff}\n`;
				}
			}

			output += '\n';
		}

		// Dependencies comparison
		if (comparison.dependencies) {
			output += `## Dependencies\n\n`;

			if (comparison.dependencies.sharedInternal.length > 0) {
				output += `### Shared Internal Dependencies (${comparison.dependencies.sharedInternal.length})\n`;
				output += `Both modules depend on:\n`;
				for (const dep of comparison.dependencies.sharedInternal.slice(0, 10)) {
					output += `  • ${dep}\n`;
				}
				if (comparison.dependencies.sharedInternal.length > 10) {
					output += `  ... and ${comparison.dependencies.sharedInternal.length - 10} more\n`;
				}
				output += '\n';
			}

			if (comparison.dependencies.sharedExternal.length > 0) {
				output += `### Shared External Dependencies (${comparison.dependencies.sharedExternal.length})\n`;
				for (const dep of comparison.dependencies.sharedExternal.slice(0, 10)) {
					output += `  • ${dep}\n`;
				}
				if (comparison.dependencies.sharedExternal.length > 10) {
					output += `  ... and ${comparison.dependencies.sharedExternal.length - 10} more\n`;
				}
				output += '\n';
			}

			if (comparison.dependencies.crossDependencies.length > 0) {
				output += `### Cross Dependencies (${comparison.dependencies.crossDependencies.length})\n`;
				output += `Direct dependencies between the modules:\n`;
				for (const dep of comparison.dependencies.crossDependencies) {
					output += `  ${dep.from} → ${dep.to} (${dep.type})\n`;
				}
				output += '\n';
			}

			if (comparison.dependencies.uniqueToModule1.length > 0) {
				output += `### Unique to ${modules.module1.name} (${comparison.dependencies.uniqueToModule1.length})\n`;
				for (const dep of comparison.dependencies.uniqueToModule1.slice(0, 5)) {
					output += `  • ${dep}\n`;
				}
				if (comparison.dependencies.uniqueToModule1.length > 5) {
					output += `  ... and ${comparison.dependencies.uniqueToModule1.length - 5} more\n`;
				}
				output += '\n';
			}

			if (comparison.dependencies.uniqueToModule2.length > 0) {
				output += `### Unique to ${modules.module2.name} (${comparison.dependencies.uniqueToModule2.length})\n`;
				for (const dep of comparison.dependencies.uniqueToModule2.slice(0, 5)) {
					output += `  • ${dep}\n`;
				}
				if (comparison.dependencies.uniqueToModule2.length > 5) {
					output += `  ... and ${comparison.dependencies.uniqueToModule2.length - 5} more\n`;
				}
				output += '\n';
			}
		}

		// API comparison
		if (comparison.api) {
			output += `## API Comparison\n\n`;

			if (comparison.api.similarExports.length > 0) {
				output += `### Similar Exports (${comparison.api.similarExports.length})\n`;
				const identical = comparison.api.similarExports.filter(e => e.identical);
				const similar = comparison.api.similarExports.filter(e => !e.identical);

				if (identical.length > 0) {
					output += `\nIdentical (${identical.length}):\n`;
					for (const exp of identical.slice(0, 10)) {
						output += `  ✓ ${exp.name}\n`;
					}
					if (identical.length > 10) {
						output += `  ... and ${identical.length - 10} more\n`;
					}
				}

				if (similar.length > 0) {
					output += `\nSimilar but different (${similar.length}):\n`;
					for (const exp of similar.slice(0, 5)) {
						output += `  ~ ${exp.name}\n`;
					}
					if (similar.length > 5) {
						output += `  ... and ${similar.length - 5} more\n`;
					}
				}
				output += '\n';
			}

			if (comparison.api.uniqueToModule1.length > 0) {
				output += `### Unique to ${modules.module1.name} (${comparison.api.uniqueToModule1.length})\n`;
				for (const exp of comparison.api.uniqueToModule1.slice(0, 10)) {
					output += `  • ${exp}\n`;
				}
				if (comparison.api.uniqueToModule1.length > 10) {
					output += `  ... and ${comparison.api.uniqueToModule1.length - 10} more\n`;
				}
				output += '\n';
			}

			if (comparison.api.uniqueToModule2.length > 0) {
				output += `### Unique to ${modules.module2.name} (${comparison.api.uniqueToModule2.length})\n`;
				for (const exp of comparison.api.uniqueToModule2.slice(0, 10)) {
					output += `  • ${exp}\n`;
				}
				if (comparison.api.uniqueToModule2.length > 10) {
					output += `  ... and ${comparison.api.uniqueToModule2.length - 10} more\n`;
				}
				output += '\n';
			}
		}

		// Recommendations
		if (comparison.analysis.recommendations.length > 0) {
			output += `## 💡 Recommendations\n\n`;
			for (let i = 0; i < comparison.analysis.recommendations.length; i++) {
				output += `${i + 1}. ${comparison.analysis.recommendations[i]}\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default CompareModulesTool;
