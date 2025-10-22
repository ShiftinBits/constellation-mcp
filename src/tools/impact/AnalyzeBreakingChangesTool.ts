/**
 * Analyze Breaking Changes Tool
 *
 * MCP tool for detecting potential breaking changes when modifying APIs, contracts, or interfaces
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatLocation } from '../../utils/format-helpers.js';

interface AnalyzeBreakingChangesParams {
	filePath: string;
	symbolName?: string;
	changeType?: 'signature' | 'visibility' | 'deletion' | 'rename' | 'type';
	includeExternalConsumers?: boolean;
}

interface BreakingChange {
	type: string;
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
	description: string;
	affectedConsumers: {
		filePath: string;
		line: number;
		context: string;
	}[];
	suggestedMigration?: string;
}

interface AnalyzeBreakingChangesResult {
	targetSymbol: {
		name: string;
		filePath: string;
		kind: string;
		currentSignature?: string;
	};
	breakingChanges: BreakingChange[];
	totalAffectedFiles: number;
	riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
	migrationComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
}

class AnalyzeBreakingChangesTool extends BaseMcpTool<
	AnalyzeBreakingChangesParams,
	AnalyzeBreakingChangesResult
> {
	name = 'analyze_breaking_changes';
	description =
		'Detect potential breaking changes when modifying APIs, contracts, or public interfaces. Analyzes what will break and provides migration guidance.';

	schema = {
		filePath: {
			type: z.string().min(1),
			description:
				'Path to file containing the symbol to analyze (e.g., "src/api/users.ts")',
		},
		symbolName: {
			type: z.string().optional(),
			description:
				'Optional: Specific symbol name to analyze. If omitted, analyzes all exported symbols in file.',
		},
		changeType: {
			type: z
				.enum(['signature', 'visibility', 'deletion', 'rename', 'type'])
				.optional(),
			description:
				'Optional: Type of change to simulate (signature, visibility, deletion, rename, type)',
		},
		includeExternalConsumers: {
			type: z.boolean().optional().default(false),
			description:
				'Include consumers from external packages (default: false)',
		},
	};

	/**
	 * Format the breaking changes analysis for AI-friendly output
	 */
	protected formatResult(
		data: AnalyzeBreakingChangesResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { targetSymbol, breakingChanges, totalAffectedFiles, riskLevel, migrationComplexity } = data;

		let output = `Breaking Changes Analysis: ${targetSymbol.name}\n\n`;

		// Target info
		output += `## Target Symbol\n`;
		output += `Name: ${targetSymbol.name}\n`;
		output += `File: ${targetSymbol.filePath}\n`;
		output += `Kind: ${targetSymbol.kind}\n`;
		if (targetSymbol.currentSignature) {
			output += `Current Signature: ${targetSymbol.currentSignature}\n`;
		}

		// Risk assessment
		output += `\n## Risk Assessment\n`;
		output += `Overall Risk: ${this.getRiskEmoji(riskLevel)} ${riskLevel}\n`;
		output += `Affected Files: ${totalAffectedFiles}\n`;
		output += `Migration Complexity: ${migrationComplexity}\n`;

		if (breakingChanges.length === 0) {
			output += `\n✅ No breaking changes detected! This modification appears safe.\n`;
		} else {
			output += `\n## Breaking Changes (${breakingChanges.length})\n\n`;

			// Sort by severity
			const sorted = [...breakingChanges].sort((a, b) => {
				const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
				return severityOrder[a.severity] - severityOrder[b.severity];
			});

			for (const change of sorted) {
				output += `### ${this.getRiskEmoji(change.severity)} ${change.type} (${change.severity})\n`;
				output += `${change.description}\n\n`;

				if (change.affectedConsumers.length > 0) {
					output += `Affected Locations (${change.affectedConsumers.length}):\n`;
					for (const consumer of change.affectedConsumers.slice(0, 10)) {
						output += `  • ${consumer.filePath}:${consumer.line}\n`;
						output += `    ${consumer.context}\n`;
					}
					if (change.affectedConsumers.length > 10) {
						output += `  ... and ${change.affectedConsumers.length - 10} more locations\n`;
					}
					output += '\n';
				}

				if (change.suggestedMigration) {
					output += `**Migration Guide:**\n${change.suggestedMigration}\n\n`;
				}
			}

			// Summary recommendations
			output += `## Recommendations\n`;
			if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
				output += `⚠️  **High Risk Change Detected**\n`;
				output += `1. Consider deprecation period before removal\n`;
				output += `2. Provide migration guide in changelog\n`;
				output += `3. Add runtime warnings if possible\n`;
				output += `4. Coordinate with affected teams\n`;
				output += `5. Consider feature flags for gradual rollout\n`;
			} else if (riskLevel === 'MEDIUM') {
				output += `1. Document breaking change in release notes\n`;
				output += `2. Update all affected consumers before release\n`;
				output += `3. Consider adding backward compatibility layer\n`;
			} else {
				output += `1. Document change in release notes\n`;
				output += `2. Update affected files as part of this PR\n`;
			}
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
}

export default AnalyzeBreakingChangesTool;
