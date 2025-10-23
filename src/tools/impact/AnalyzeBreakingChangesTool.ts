/**
 * Analyze Breaking Changes Tool
 *
 * MCP tool for detecting potential breaking changes when modifying APIs, contracts, or interfaces
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatLocation } from '../../utils/format-helpers.js';

interface SymbolChange {
	type: 'add' | 'remove' | 'modify' | 'rename';
	symbolName: string;
	newName?: string;
}

interface AnalyzeBreakingChangesParams {
	filePath: string;
	changes?: SymbolChange[];
	symbolName?: string;
	autoDetect?: boolean;
	includeSuggestions?: boolean;
	includeConfidence?: boolean;
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
		changes: {
			type: z
				.array(
					z.object({
						type: z.enum(['add', 'remove', 'modify', 'rename']),
						symbolName: z.string().min(1),
						newName: z.string().optional(),
					}),
				)
				.optional(),
			description:
				'Specific changes to analyze (optional - if not provided, analyzes all exported symbols)',
		},
		symbolName: {
			type: z.string().optional(),
			description:
				'Specific symbol to analyze (optional - used with autoDetect mode)',
		},
		autoDetect: {
			type: z.coerce.boolean().optional().default(true),
			description:
				'Automatically analyze all exported symbols (default: true)',
		},
		includeSuggestions: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include migration suggestions (default: true)',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include confidence scores (default: false)',
		},
	};

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the breaking changes analysis for AI-friendly output
	 */
	protected formatResult(
		data: AnalyzeBreakingChangesResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { targetSymbol, breakingChanges, totalAffectedFiles, riskLevel, migrationComplexity } = data;
		const changes = breakingChanges || [];
		const affectedFiles = totalAffectedFiles || 0;
		const risk = riskLevel || 'LOW';
		const complexity = migrationComplexity || 'SIMPLE';

		let output = `Breaking Changes Analysis: ${targetSymbol?.name || 'unknown'}\n\n`;

		// Target info
		if (targetSymbol) {
			output += `## Target Symbol\n`;
			output += `Name: ${targetSymbol.name || 'unknown'}\n`;
			output += `File: ${targetSymbol.filePath || 'unknown'}\n`;
			output += `Kind: ${targetSymbol.kind || 'unknown'}\n`;
			if (targetSymbol.currentSignature) {
				output += `Current Signature: ${targetSymbol.currentSignature}\n`;
			}
		}

		// Risk assessment
		output += `\n## Risk Assessment\n`;
		output += `Overall Risk: ${this.getRiskEmoji(risk)} ${risk}\n`;
		output += `Affected Files: ${affectedFiles}\n`;
		output += `Migration Complexity: ${complexity}\n`;

		if (changes.length === 0) {
			output += `\n✅ No breaking changes detected! This modification appears safe.\n`;
		} else {
			output += `\n## Breaking Changes (${changes.length})\n\n`;

			// Sort by severity
			const sorted = [...changes].sort((a, b) => {
				const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
				const aSev = a?.severity || 'LOW';
				const bSev = b?.severity || 'LOW';
				return severityOrder[aSev] - severityOrder[bSev];
			});

			for (const change of sorted) {
				const severity = change?.severity || 'MEDIUM';
				const type = change?.type || 'change';
				const description = change?.description || 'Breaking change detected';
				const affectedConsumers = change?.affectedConsumers || [];

				output += `### ${this.getRiskEmoji(severity)} ${type} (${severity})\n`;
				output += `${description}\n\n`;

				if (affectedConsumers.length > 0) {
					output += `Affected Locations (${affectedConsumers.length}):\n`;
					for (const consumer of affectedConsumers.slice(0, 10)) {
						const filePath = consumer?.filePath || 'unknown';
						const line = consumer?.line || 0;
						const context = consumer?.context || '';
						output += `  • ${filePath}:${line}\n`;
						if (context) {
							output += `    ${context}\n`;
						}
					}
					if (affectedConsumers.length > 10) {
						output += `  ... and ${affectedConsumers.length - 10} more locations\n`;
					}
					output += '\n';
				}

				if (change?.suggestedMigration) {
					output += `**Migration Guide:**\n${change.suggestedMigration}\n\n`;
				}
			}

			// Summary recommendations
			output += `## Recommendations\n`;
			if (risk === 'CRITICAL' || risk === 'HIGH') {
				output += `⚠️  **High Risk Change Detected**\n`;
				output += `1. Consider deprecation period before removal\n`;
				output += `2. Provide migration guide in changelog\n`;
				output += `3. Add runtime warnings if possible\n`;
				output += `4. Coordinate with affected teams\n`;
				output += `5. Consider feature flags for gradual rollout\n`;
			} else if (risk === 'MEDIUM') {
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
