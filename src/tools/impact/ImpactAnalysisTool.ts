/**
 * Impact Analysis Tool
 *
 * MCP tool for comprehensive impact analysis combining change impact, breaking changes,
 * and dependency analysis into a single holistic view
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';

interface ImpactAnalysisParams {
	symbolId?: string;
	qualifiedName?: string;
	symbolName?: string;
	filePath?: string;
	includeDirectDependents?: boolean;
	includeTransitiveDependents?: boolean;
	depth?: number;
	excludeTests?: boolean;
	excludeGenerated?: boolean;
	analyzeBreakingChanges?: boolean;
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
		symbolId: {
			type: z.string().optional(),
			description: 'Unique symbol identifier',
		},
		qualifiedName: {
			type: z.string().optional(),
			description: 'Qualified symbol name',
		},
		symbolName: {
			type: z.string().optional(),
			description: 'Symbol name',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'File path (required for symbol-level or for file-level analysis)',
		},
		includeDirectDependents: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include direct dependents (default: true)',
		},
		includeTransitiveDependents: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include transitive dependents (default: true)',
		},
		depth: {
			type: z.coerce.number().int().min(1).max(5).optional().default(3),
			description: 'Maximum dependency depth to analyze (default: 3, max: 5)',
		},
		excludeTests: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Exclude test files from analysis (default: true)',
		},
		excludeGenerated: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Exclude generated files from analysis (default: true)',
		},
		analyzeBreakingChanges: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Analyze potential breaking changes (default: true)',
		},
	};

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the comprehensive impact analysis for AI-friendly output
	 */
	protected formatResult(
		data: ImpactAnalysisResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive check
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { symbol, directDependents, transitiveDependents, impactedFiles, breakingChangeRisk, summary } = data;

		let output = `Comprehensive Impact Analysis\n\n`;

		// Target info
		output += `## Target\n`;
		output += `Type: ${symbol.kind}\n`;
		output += `Name: ${symbol.name}\n`;
		if (symbol.filePath) {
			output += `File: ${symbol.filePath}\n`;
		}

		// Summary
		output += `\n## Impact Summary\n`;
		const directCount = directDependents?.length || 0;
		const transitiveCount = transitiveDependents?.length || 0;
		const impactedFileCount = impactedFiles?.length || 0;

		output += `Direct Dependents: ${directCount}\n`;
		output += `Transitive Dependents: ${transitiveCount}\n`;
		output += `Impacted Files: ${impactedFileCount}\n`;
		output += `Test Files: ${summary.testFileCount || 0}\n`;
		output += `Production Files: ${summary.productionFileCount || 0}\n`;
		output += `Max Depth: ${summary.maxDepth}\n`;

		// Direct dependents
		if (directCount > 0) {
			output += `\n## 🎯 Direct Dependents (${directCount})\n\n`;
			for (const dep of directDependents!.slice(0, 10)) {
				output += `  ${dep.name} (${dep.kind})\n`;
				output += `    ${dep.filePath}:${dep.line}\n`;
				output += `    Relationship: ${dep.relationshipType}\n`;
				if (dep.isExported) {
					output += `    ⚠️  Exported - breaking change risk\n`;
				}
				output += '\n';
			}
			if (directCount > 10) {
				output += `  ... and ${directCount - 10} more\n\n`;
			}
		}

		// Transitive dependents
		if (transitiveCount > 0) {
			output += `## 🔄 Transitive Dependents (${transitiveCount})\n\n`;
			for (const dep of transitiveDependents!.slice(0, 10)) {
				output += `  ${dep.name} (${dep.kind}) - depth ${dep.depth}\n`;
				output += `    ${dep.filePath}:${dep.line}\n`;
				output += `    Relationship: ${dep.relationshipType}\n`;
				output += '\n';
			}
			if (transitiveCount > 10) {
				output += `  ... and ${transitiveCount - 10} more\n\n`;
			}
		}

		// Impacted files
		if (impactedFileCount > 0) {
			output += `## 📁 Impacted Files (${impactedFileCount})\n\n`;
			for (const file of impactedFiles!.slice(0, 15)) {
				output += `  ${file.filePath}\n`;
				output += `    ${file.symbolCount} symbol(s) affected\n`;
				if (file.isTest) {
					output += `    🧪 Test file\n`;
				}
				if (file.symbols && file.symbols.length > 0) {
					output += `    Symbols: ${file.symbols.map(s => s.name).join(', ')}\n`;
				}
				output += '\n';
			}
			if (impactedFileCount > 15) {
				output += `  ... and ${impactedFileCount - 15} more files\n\n`;
			}
		}

		// Breaking change risk
		if (breakingChangeRisk) {
			output += `## ⚠️  Breaking Change Risk\n`;
			output += `Level: ${this.getRiskEmoji(breakingChangeRisk.riskLevel)} ${breakingChangeRisk.riskLevel.toUpperCase()}\n\n`;

			if (breakingChangeRisk.factors && breakingChangeRisk.factors.length > 0) {
				output += `### Risk Factors:\n`;
				for (const factor of breakingChangeRisk.factors) {
					output += `  • **${factor.factor}** (${factor.severity})\n`;
					output += `    ${factor.description}\n`;
				}
				output += '\n';
			}

			if (breakingChangeRisk.recommendations && breakingChangeRisk.recommendations.length > 0) {
				output += `### 📋 Recommendations:\n`;
				for (let i = 0; i < breakingChangeRisk.recommendations.length; i++) {
					output += `${i + 1}. ${breakingChangeRisk.recommendations[i]}\n`;
				}
			}
		}

		// Action plan
		output += `\n## 🎯 Suggested Action Plan\n\n`;
		const riskLevel = breakingChangeRisk?.riskLevel || 'low';
		const totalImpacted = directCount + transitiveCount;
		const hasCriticalPaths = (breakingChangeRisk?.factors?.length || 0) > 0;

		if (riskLevel === 'critical' || riskLevel === 'high') {
			output += `1. **Review Dependencies**: Understand all critical paths\n`;
			output += `2. **Create Feature Branch**: Isolate changes\n`;
			output += `3. **Update Tests First**: Ensure test coverage\n`;
			output += `4. **Make Changes Incrementally**: Small, testable steps\n`;
			output += `5. **Update Documentation**: Keep docs in sync\n`;
			output += `6. **Coordinate with Team**: High-impact change requires review\n`;
			output += `7. **Monitor After Deploy**: Watch for issues\n`;
		} else if (riskLevel === 'medium') {
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

		// Contextual follow-up tools
		output += `\n\n## 🔍 Recommended Follow-up Tools\n\n`;

		if (totalImpacted > 100) {
			output += `- **trace_symbol_usage** - Large impact surface (${totalImpacted} dependents). Trace usage patterns to understand how this symbol is called.\n`;
		}

		if (hasCriticalPaths && impactedFileCount > 0) {
			output += `- **get_call_graph** - Critical paths detected. Visualize call chains to understand execution flow impacts.\n`;
		}

		if (impactedFileCount > 20) {
			output += `- **search_files** - ${impactedFileCount} files affected. Search for specific patterns or imports that need updating.\n`;
		}

		if (directCount > 10) {
			output += `- **get_dependents** - ${directCount} direct dependents. Get detailed dependent analysis for refactoring planning.\n`;
		}

		if (breakingChangeRisk && (riskLevel === 'critical' || riskLevel === 'high')) {
			output += `- **detect_circular_dependencies** - High risk change. Verify no circular dependencies complicate refactoring.\n`;
			output += `- **get_symbol_details** - Review symbol signature and documentation before changing.\n`;
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


	private capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

export default ImpactAnalysisTool;
