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
	symbolName?: string;
	changeType?: 'modify' | 'delete' | 'rename';
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
		symbolName: {
			type: z.string().optional(),
			description: 'Symbol name to analyze (alternative to filePath)',
		},
		changeType: {
			type: z.enum(['modify', 'delete', 'rename']).optional().default('modify'),
			description:
				'Type of change: "modify" (default), "delete", or "rename"',
		},
	};

	/**
	 * Format the change impact analysis for AI-friendly output
	 */
	protected formatResult(
		data: AnalyzeChangeImpactResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { target, impactSummary, affectedFiles, recommendations } = data;

		let output = `Change Impact Analysis\n\n`;
		output += `Target: ${target.name} (${target.type})\n`;
		output += `Location: ${target.location}\n\n`;

		// Impact summary
		output += `## Impact Summary\n`;
		output += `Total affected files: ${impactSummary.totalAffectedFiles}\n`;
		output += `  🔴 High impact: ${impactSummary.highImpact}\n`;
		output += `  🟡 Medium impact: ${impactSummary.mediumImpact}\n`;
		output += `  🟢 Low impact: ${impactSummary.lowImpact}\n\n`;

		if (affectedFiles.length === 0) {
			output += '✅ No files will be affected by this change. Safe to proceed!\n';
		} else {
			// Group by impact level
			const high = affectedFiles.filter((f) => f.impactLevel === 'high');
			const medium = affectedFiles.filter((f) => f.impactLevel === 'medium');
			const low = affectedFiles.filter((f) => f.impactLevel === 'low');

			if (high.length > 0) {
				output += `## 🔴 High Impact Files (${high.length})\n`;
				output += 'These files will likely break:\n\n';
				for (const file of high.slice(0, 10)) {
					output += `  ${file.filePath}\n`;
					output += `    ${file.reason}\n`;
					if (file.affectedSymbols && file.affectedSymbols.length > 0) {
						output += `    Symbols: ${file.affectedSymbols.join(', ')}\n`;
					}
					output += '\n';
				}
				if (high.length > 10) {
					output += `  ... and ${high.length - 10} more\n\n`;
				}
			}

			if (medium.length > 0) {
				output += `## 🟡 Medium Impact Files (${medium.length})\n`;
				output += 'These files may need updates:\n\n';
				for (const file of medium.slice(0, 5)) {
					output += `  ${file.filePath}\n`;
					output += `    ${file.reason}\n`;
				}
				if (medium.length > 5) {
					output += `  ... and ${medium.length - 5} more\n`;
				}
				output += '\n';
			}

			if (low.length > 0) {
				output += `## 🟢 Low Impact Files (${low.length})\n`;
				output += 'Review recommended but likely safe\n\n';
			}
		}

		// Recommendations
		if (recommendations.length > 0) {
			output += `## 💡 Recommendations\n`;
			for (let i = 0; i < recommendations.length; i++) {
				output += `${i + 1}. ${recommendations[i]}\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default AnalyzeChangeImpactTool;
