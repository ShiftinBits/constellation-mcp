/**
 * Analyze Change Impact Tool
 *
 * MCP tool for analyzing the impact of changing a file or symbol
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatLocation } from '../../utils/format-helpers.js';

interface AnalyzeChangeImpactParams {
	filePath?: string;
	symbolId?: string;
	includeTransitive?: boolean;
	includeTests?: boolean;
	includeRiskLevel?: boolean;
	includeConfidence?: boolean;
}

interface ImpactedFile {
	filePath: string;
	impactLevel: 'high' | 'medium' | 'low';
	reason: string;
	affectedSymbols?: string[];
}

interface AnalyzeChangeImpactResult {
	target: {
		type: 'file' | 'symbol';
		name: string;
		location: string;
	};
	impactSummary: {
		totalAffectedFiles: number;
		highImpact: number;
		mediumImpact: number;
		lowImpact: number;
	};
	affectedFiles: ImpactedFile[];
	recommendations: string[];
}

class AnalyzeChangeImpactTool extends BaseMcpTool<
	AnalyzeChangeImpactParams,
	AnalyzeChangeImpactResult
> {
	name = 'analyze_change_impact';
	description =
		'Analyze the impact of changing or deleting a file or symbol. Shows what will break, what needs updating, and provides recommendations.';

	schema = {
		filePath: {
			type: z.string().optional(),
			description: 'File path to analyze for change impact',
		},
		symbolId: {
			type: z.string().optional(),
			description: 'Symbol ID to analyze (alternative to filePath)',
		},
		includeTransitive: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include transitive (indirect) impact (default: false)',
		},
		includeTests: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include test files in impact analysis (default: false)',
		},
		includeRiskLevel: {
			type: z.coerce.boolean().optional().default(true),
			description:
				'Include risk level assessment (default: true)',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include confidence scores (default: false)',
		},
	};

	/**
	 * Format the change impact analysis for AI-friendly output
	 */
	protected formatResult(
		data: AnalyzeChangeImpactResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { target, affectedDirectly, affectedTransitively, relatedTests, risk } = data;

		let output = `Change Impact Analysis\n\n`;

		// Target info
		if (target) {
			output += `Target: ${target.path || 'unknown'}`;
			if (target.name) {
				output += ` (${target.name})`;
			}
			output += ` [${target.type || 'unknown'}]\n\n`;
		}

		// Count affected files
		const directCount = affectedDirectly?.length || 0;
		const transitiveCount = affectedTransitively?.length || 0;
		const totalAffected = directCount + transitiveCount;

		// Risk assessment
		if (risk) {
			output += `## Risk Assessment\n`;
			output += `Level: ${risk.level?.toUpperCase() || 'UNKNOWN'}\n`;
			output += `Score: ${risk.score || 0}/100\n\n`;

			if (risk.factors) {
				output += `### Risk Factors\n`;
				output += `Files Affected: ${risk.factors.filesAffected || 0}\n`;
				output += `Transitive Depth: ${risk.factors.transitiveDepth || 0}\n`;
				output += `Public API Exposure: ${risk.factors.publicApiExposure ? 'yes' : 'no'}\n`;
				output += `Test Coverage: ${risk.factors.testCoverage || 0}%\n`;
				output += `Critical Files Affected: ${risk.factors.criticalFilesAffected || 0}\n\n`;
			}
		}

		// Direct impact
		if (directCount > 0) {
			output += `## 🔴 Directly Affected Files (${directCount})\n\n`;
			for (const file of affectedDirectly!.slice(0, 10)) {
				output += `  ${file?.filePath || 'unknown'}`;
				if (file?.critical) {
					output += ` ⚠️ CRITICAL`;
				}
				output += `\n`;
				if (file?.reason) {
					output += `    ${file.reason}\n`;
				}
				if (file?.distance !== undefined) {
					output += `    Distance: ${file.distance}\n`;
				}
				output += '\n';
			}
			if (directCount > 10) {
				output += `  ... and ${directCount - 10} more\n\n`;
			}
		}

		// Transitive impact
		if (transitiveCount > 0) {
			output += `## 🟡 Transitively Affected Files (${transitiveCount})\n\n`;
			for (const file of affectedTransitively!.slice(0, 10)) {
				output += `  ${file?.filePath || 'unknown'}`;
				if (file?.critical) {
					output += ` ⚠️ CRITICAL`;
				}
				if (file?.distance !== undefined) {
					output += ` (distance: ${file.distance})`;
				}
				output += `\n`;
				if (file?.reason) {
					output += `    ${file.reason}\n`;
				}
				if (file?.chain && file.chain.length > 0) {
					output += `    Chain: ${file.chain.join(' → ')}\n`;
				}
				output += '\n';
			}
			if (transitiveCount > 10) {
				output += `  ... and ${transitiveCount - 10} more\n\n`;
			}
		}

		// Related tests
		const testCount = relatedTests?.length || 0;
		if (testCount > 0) {
			output += `## 🧪 Related Test Files (${testCount})\n\n`;
			for (const test of relatedTests!.slice(0, 10)) {
				output += `  • ${test}\n`;
			}
			if (testCount > 10) {
				output += `  ... and ${testCount - 10} more\n`;
			}
			output += '\n';
		}

		// Recommendations
		if (risk?.recommendations && risk.recommendations.length > 0) {
			output += `## 💡 Recommendations\n\n`;
			for (let i = 0; i < risk.recommendations.length; i++) {
				output += `${i + 1}. ${risk.recommendations[i]}\n`;
			}
			output += '\n';
		}

		// Summary
		if (totalAffected === 0) {
			output += '✅ No files will be affected by this change. Safe to proceed!\n';
		} else {
			output += `## Summary\n`;
			output += `Total Affected: ${totalAffected} file${totalAffected === 1 ? '' : 's'}\n`;
			output += `  - Direct: ${directCount}\n`;
			output += `  - Transitive: ${transitiveCount}\n`;
			if (testCount > 0) {
				output += `  - Tests: ${testCount}\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default AnalyzeChangeImpactTool;
