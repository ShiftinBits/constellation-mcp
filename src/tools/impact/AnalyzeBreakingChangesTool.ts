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
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include consumers from external packages (default: false)',
		},
	};

	/**
	 * Override execute to transform parameters before API call
	 * Generate changes array based on changeType
	 */
	async execute(input: AnalyzeBreakingChangesParams): Promise<string> {
		// Build changes array from parameters
		const changes = [];

		// If changeType is specified, create a change entry
		if (input.changeType) {
			const change: any = {
				type: input.changeType,
			};

			// If symbolName provided, target specific symbol
			if (input.symbolName) {
				change.symbolName = input.symbolName;
			}

			changes.push(change);
		} else {
			// Default: analyze all exported symbols for potential breaking changes
			changes.push({
				type: 'signature', // Default change type
			});
		}

		// Pass transformed parameters to API
		const apiParams = {
			...input,
			changes,
		};

		return super.execute(apiParams);
	}

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
