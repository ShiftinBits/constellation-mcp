/**
 * Compare Modules Tool
 *
 * MCP tool for comparing two modules to understand their similarities, differences, and relationships
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface CompareModulesParams {
	module1?: string;
	module2?: string;
	moduleA?: string;
	moduleB?: string;
	includeStructure?: boolean;
	includePatterns?: boolean;
	includeDependencies?: boolean;
	includeSimilarity?: boolean;
	includeConfidence?: boolean;
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
			type: z.string().optional(),
			description: 'Path to first module (e.g., "src/services/auth")',
		},
		module2: {
			type: z.string().optional(),
			description: 'Path to second module (e.g., "src/services/users")',
		},
		moduleA: {
			type: z.string().optional(),
			description: 'Path to first module (alternative naming)',
		},
		moduleB: {
			type: z.string().optional(),
			description: 'Path to second module (alternative naming)',
		},
		includeStructure: {
			type: z.coerce.boolean().optional().default(true),
			description:
				'Include structure comparison (default: true)',
		},
		includePatterns: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include pattern analysis (default: true)',
		},
		includeDependencies: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include dependency comparison (default: true)',
		},
		includeSimilarity: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include similarity scoring (default: true)',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include confidence scores (default: false)',
		},
	};

	/**
	 * Format the module comparison for AI-friendly output
	 */
	protected formatResult(
		data: CompareModulesResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		// Backend DTO uses moduleA, moduleB, structure, patterns, dependencies, similarity, insights
		const { moduleA, moduleB, structure, patterns, dependencies, similarity, insights } = data as any;

		let output = `Module Comparison\n\n`;

		// Module info
		output += `## Modules\n\n`;
		output += `**Module A:** ${moduleA?.name || 'unknown'}\n`;
		output += `  Path: ${moduleA?.path || 'unknown'}\n`;
		if (moduleA?.exists !== undefined) {
			output += `  Exists: ${moduleA.exists ? 'Yes' : 'No'}\n`;
		}
		output += '\n';

		output += `**Module B:** ${moduleB?.name || 'unknown'}\n`;
		output += `  Path: ${moduleB?.path || 'unknown'}\n`;
		if (moduleB?.exists !== undefined) {
			output += `  Exists: ${moduleB.exists ? 'Yes' : 'No'}\n`;
		}
		output += '\n';

		// Similarity score
		if (similarity) {
			output += `## Similarity Analysis\n`;
			output += `Overall Score: ${((similarity?.overallScore || 0) * 100).toFixed(1)}%\n`;
			if (similarity?.structuralSimilarity !== undefined) {
				output += `Structural Similarity: ${(similarity.structuralSimilarity * 100).toFixed(1)}%\n`;
			}
			if (similarity?.apiSimilarity !== undefined) {
				output += `API Similarity: ${(similarity.apiSimilarity * 100).toFixed(1)}%\n`;
			}
			if (similarity?.dependencySimilarity !== undefined) {
				output += `Dependency Similarity: ${(similarity.dependencySimilarity * 100).toFixed(1)}%\n`;
			}
			output += '\n';
		}

		// Structure comparison
		if (structure) {
			output += `## Structure Comparison\n\n`;

			if (structure?.fileCountDifference !== undefined) {
				const diff = structure.fileCountDifference;
				if (diff !== 0) {
					const larger = diff > 0 ? 'Module A' : 'Module B';
					output += `${larger} has ${Math.abs(diff)} more files\n`;
				}
			}
			if (structure?.symbolCountDifference !== undefined) {
				const diff = structure.symbolCountDifference;
				if (diff !== 0) {
					const larger = diff > 0 ? 'Module A' : 'Module B';
					output += `${larger} has ${Math.abs(diff)} more symbols\n`;
				}
			}
			if (structure?.locDifference !== undefined) {
				const diff = structure.locDifference;
				if (diff !== 0) {
					const larger = diff > 0 ? 'Module A' : 'Module B';
					output += `${larger} has ${Math.abs(diff)} more lines of code\n`;
				}
			}

			if (structure?.commonPatterns && structure.commonPatterns.length > 0) {
				output += `\n### Common Patterns (${structure.commonPatterns.length})\n`;
				for (const pattern of structure.commonPatterns) {
					output += `  ✓ ${pattern}\n`;
				}
			}

			if (structure?.uniqueToA && structure.uniqueToA.length > 0) {
				output += `\n### Unique to Module A (${structure.uniqueToA.length})\n`;
				for (const item of structure.uniqueToA.slice(0, 5)) {
					output += `  • ${item}\n`;
				}
				if (structure.uniqueToA.length > 5) {
					output += `  ... and ${structure.uniqueToA.length - 5} more\n`;
				}
			}

			if (structure?.uniqueToB && structure.uniqueToB.length > 0) {
				output += `\n### Unique to Module B (${structure.uniqueToB.length})\n`;
				for (const item of structure.uniqueToB.slice(0, 5)) {
					output += `  • ${item}\n`;
				}
				if (structure.uniqueToB.length > 5) {
					output += `  ... and ${structure.uniqueToB.length - 5} more\n`;
				}
			}

			output += '\n';
		}

		// Dependencies comparison
		if (dependencies) {
			output += `## Dependencies\n\n`;

			const sharedCount = dependencies?.sharedDependencies?.length || 0;
			if (sharedCount > 0) {
				output += `### Shared Dependencies (${sharedCount})\n`;
				output += `Both modules depend on:\n`;
				for (const dep of dependencies.sharedDependencies!.slice(0, 10)) {
					output += `  • ${dep}\n`;
				}
				if (sharedCount > 10) {
					output += `  ... and ${sharedCount - 10} more\n`;
				}
				output += '\n';
			}

			const uniqueACount = dependencies?.uniqueToA?.length || 0;
			if (uniqueACount > 0) {
				output += `### Unique to Module A (${uniqueACount})\n`;
				for (const dep of dependencies.uniqueToA!.slice(0, 10)) {
					output += `  • ${dep}\n`;
				}
				if (uniqueACount > 10) {
					output += `  ... and ${uniqueACount - 10} more\n`;
				}
				output += '\n';
			}

			const uniqueBCount = dependencies?.uniqueToB?.length || 0;
			if (uniqueBCount > 0) {
				output += `### Unique to Module B (${uniqueBCount})\n`;
				for (const dep of dependencies.uniqueToB!.slice(0, 10)) {
					output += `  • ${dep}\n`;
				}
				if (uniqueBCount > 10) {
					output += `  ... and ${uniqueBCount - 10} more\n`;
				}
				output += '\n';
			}

			if (dependencies?.crossReferences && dependencies.crossReferences.length > 0) {
				output += `### Cross References (${dependencies.crossReferences.length})\n`;
				output += `Direct dependencies between the modules:\n`;
				for (const ref of dependencies.crossReferences) {
					output += `  ${ref?.from || 'unknown'} → ${ref?.to || 'unknown'}`;
					if (ref?.type) {
						output += ` (${ref.type})`;
					}
					output += '\n';
				}
				output += '\n';
			}
		}

		// Insights
		if (insights && insights.length > 0) {
			output += `## 💡 Insights & Recommendations\n\n`;
			for (const insight of insights) {
				const severity = insight?.severity || 'info';
				const emoji = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : '🟢';
				output += `${emoji} **${insight?.title || 'Insight'}**\n`;
				output += `${insight?.description || 'No description'}\n`;
				if (insight?.recommendation) {
					output += `Recommendation: ${insight.recommendation}\n`;
				}
				output += '\n';
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default CompareModulesTool;
