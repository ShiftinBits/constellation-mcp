/**
 * Impact Analysis Tool
 *
 * MCP tool for comprehensive impact analysis combining change impact, breaking changes,
 * and dependency analysis into a single holistic view
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface ImpactAnalysisParams {
	symbolId?: string;
	filePath?: string;
	symbolName?: string;
	changeType?: 'modify' | 'delete' | 'rename' | 'refactor';
	includeTests?: boolean;
	includeDocs?: boolean;
	maxDepth?: number;
}

interface ImpactArea {
	category: 'direct' | 'indirect' | 'test' | 'documentation' | 'configuration';
	affectedFiles: string[];
	description: string;
	effort: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTENSIVE';
}

interface ImpactAnalysisResult {
	target: {
		type: 'file' | 'symbol';
		name: string;
		filePath: string;
	};
	summary: {
		totalAffectedFiles: number;
		totalAffectedSymbols: number;
		riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
		estimatedEffort: string;
		confidence: number;
	};
	impactAreas: ImpactArea[];
	criticalPaths: {
		path: string[];
		reason: string;
	}[];
	recommendations: string[];
	relatedChanges: {
		filePath: string;
		reason: string;
		required: boolean;
	}[];
}

class ImpactAnalysisTool extends BaseMcpTool<
	ImpactAnalysisParams,
	ImpactAnalysisResult
> {
	name = 'impact_analysis';
	description =
		'Comprehensive impact analysis combining change impact, breaking changes, and dependencies. Provides holistic view of what changes will affect across the codebase.';

	schema = {
		filePath: {
			type: z.string().optional(),
			description:
				'Path to file to analyze (e.g., "src/services/auth.ts"). Required if symbolName not provided.',
		},
		symbolName: {
			type: z.string().optional(),
			description:
				'Specific symbol name to analyze. If provided without filePath, searches entire codebase.',
		},
		changeType: {
			type: z.enum(['modify', 'delete', 'rename', 'refactor']).optional(),
			description:
				'Type of change being analyzed (default: modify)',
		},
		includeTests: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include test files in analysis (default: true)',
		},
		includeDocs: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include documentation files in analysis (default: true)',
		},
		maxDepth: {
			type: z.coerce.number().min(1).max(10).optional().default(5),
			description:
				'Maximum dependency depth to analyze (default: 5)',
		},
	};

	/**
	 * Override execute to generate symbolId from filePath + symbolName if needed
	 */
	async execute(input: ImpactAnalysisParams): Promise<string> {
		// If symbolId not provided but filePath and symbolName are, generate it
		if (!input.symbolId && input.filePath && input.symbolName) {
			const symbolId = this.generateSymbolId(input.filePath, input.symbolName);
			input = { ...input, symbolId };
		}

		return super.execute(input);
	}

	/**
	 * Format the comprehensive impact analysis for AI-friendly output
	 */
	protected formatResult(
		data: ImpactAnalysisResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { target, summary, impactAreas, criticalPaths, recommendations, relatedChanges } = data;

		let output = `Comprehensive Impact Analysis\n\n`;

		// Target info
		output += `## Target\n`;
		output += `Type: ${target.type}\n`;
		output += `Name: ${target.name}\n`;
		if (target.filePath) {
			output += `File: ${target.filePath}\n`;
		}

		// Summary
		output += `\n## Impact Summary\n`;
		output += `Risk Level: ${this.getRiskEmoji(summary.riskLevel)} ${summary.riskLevel}\n`;
		output += `Affected Files: ${summary.totalAffectedFiles}\n`;
		output += `Affected Symbols: ${summary.totalAffectedSymbols}\n`;
		output += `Estimated Effort: ${summary.estimatedEffort}\n`;
		output += `Confidence: ${summary.confidence}%\n`;

		// Impact areas
		if (impactAreas.length > 0) {
			output += `\n## Impact Areas (${impactAreas.length})\n\n`;

			for (const area of impactAreas) {
				output += `### ${this.getCategoryEmoji(area.category)} ${this.capitalize(area.category)} Impact\n`;
				output += `${area.description}\n`;
				output += `Effort: ${area.effort}\n`;
				output += `Affected Files: ${area.affectedFiles.length}\n`;

				if (area.affectedFiles.length > 0 && area.affectedFiles.length <= 5) {
					for (const file of area.affectedFiles) {
						output += `  • ${file}\n`;
					}
				} else if (area.affectedFiles.length > 5) {
					for (const file of area.affectedFiles.slice(0, 3)) {
						output += `  • ${file}\n`;
					}
					output += `  ... and ${area.affectedFiles.length - 3} more files\n`;
				}
				output += '\n';
			}
		}

		// Critical paths
		if (criticalPaths.length > 0) {
			output += `## 🔴 Critical Dependency Paths (${criticalPaths.length})\n\n`;
			for (const critical of criticalPaths.slice(0, 5)) {
				output += `**${critical.reason}**\n`;
				output += `Path: ${critical.path.join(' → ')}\n\n`;
			}
			if (criticalPaths.length > 5) {
				output += `... and ${criticalPaths.length - 5} more critical paths\n\n`;
			}
		}

		// Related changes
		if (relatedChanges.length > 0) {
			output += `## Related Changes Required\n\n`;

			const required = relatedChanges.filter(c => c.required);
			const optional = relatedChanges.filter(c => !c.required);

			if (required.length > 0) {
				output += `### ⚠️  Required Changes (${required.length})\n`;
				for (const change of required) {
					output += `  • ${change.filePath}\n`;
					output += `    ${change.reason}\n`;
				}
				output += '\n';
			}

			if (optional.length > 0) {
				output += `### 💡 Recommended Changes (${optional.length})\n`;
				for (const change of optional.slice(0, 5)) {
					output += `  • ${change.filePath}\n`;
					output += `    ${change.reason}\n`;
				}
				if (optional.length > 5) {
					output += `  ... and ${optional.length - 5} more recommendations\n`;
				}
				output += '\n';
			}
		}

		// Recommendations
		if (recommendations.length > 0) {
			output += `## 📋 Recommendations\n\n`;
			for (let i = 0; i < recommendations.length; i++) {
				output += `${i + 1}. ${recommendations[i]}\n`;
			}
		}

		// Action plan
		output += `\n## 🎯 Suggested Action Plan\n\n`;
		if (summary.riskLevel === 'CRITICAL' || summary.riskLevel === 'HIGH') {
			output += `1. **Review Dependencies**: Understand all critical paths\n`;
			output += `2. **Create Feature Branch**: Isolate changes\n`;
			output += `3. **Update Tests First**: Ensure test coverage\n`;
			output += `4. **Make Changes Incrementally**: Small, testable steps\n`;
			output += `5. **Update Documentation**: Keep docs in sync\n`;
			output += `6. **Coordinate with Team**: High-impact change requires review\n`;
			output += `7. **Monitor After Deploy**: Watch for issues\n`;
		} else if (summary.riskLevel === 'MEDIUM') {
			output += `1. **Review Impact Areas**: Understand what's affected\n`;
			output += `2. **Update Tests**: Ensure coverage for changes\n`;
			output += `3. **Make Changes**: Implement modifications\n`;
			output += `4. **Update Related Files**: Address required changes\n`;
			output += `5. **Run Full Test Suite**: Verify nothing breaks\n`;
		} else {
			output += `1. **Make Changes**: Low-risk modification\n`;
			output += `2. **Update Tests**: Quick verification\n`;
			output += `3. **Run Relevant Tests**: Targeted test execution\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

	private getRiskEmoji(level: string): string {
		switch (level) {
			case 'CRITICAL':
				return '🔴';
			case 'HIGH':
				return '🟠';
			case 'MEDIUM':
				return '🟡';
			case 'LOW':
				return '🟢';
			default:
				return '⚪';
		}
	}

	private getCategoryEmoji(category: string): string {
		switch (category) {
			case 'direct':
				return '🎯';
			case 'indirect':
				return '🔄';
			case 'test':
				return '🧪';
			case 'documentation':
				return '📚';
			case 'configuration':
				return '⚙️';
			default:
				return '📦';
		}
	}

	private capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

export default ImpactAnalysisTool;
