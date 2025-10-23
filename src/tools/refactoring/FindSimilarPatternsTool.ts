/**
 * Find Similar Patterns Tool
 *
 * MCP tool for finding duplicate or similar code patterns that could be refactored
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface FindSimilarPatternsParams {
	referenceFile?: string;
	referenceSymbol?: string;
	filterByKind?: string;
	filterByParadigm?: string;
	filterByModuleType?: string;
	minSimilarity?: number;
	includeConfidence?: boolean;
	limit?: number;
	offset?: number;
}

interface SimilarPattern {
	type: 'duplicate' | 'similar';
	patternId: string;
	occurrences: Array<{
		filePath: string;
		startLine: number;
		endLine: number;
		snippet: string;
	}>;
	similarity: number;
	linesOfCode: number;
	refactoringOpportunity: {
		difficulty: 'EASY' | 'MEDIUM' | 'HARD';
		estimatedSavings: number;
		suggestion: string;
	};
}

interface FindSimilarPatternsResult {
	summary: {
		totalPatterns: number;
		totalOccurrences: number;
		potentialLineSavings: number;
		byType: Record<string, number>;
	};
	patterns: SimilarPattern[];
	highPriorityRefactorings: Array<{
		patternId: string;
		reason: string;
		priority: 'HIGH' | 'MEDIUM' | 'LOW';
	}>;
}

class FindSimilarPatternsTool extends BaseMcpTool<
	FindSimilarPatternsParams,
	FindSimilarPatternsResult
> {
	name = 'find_similar_patterns';
	description =
		'Find duplicate or similar code patterns across the codebase. Identifies refactoring opportunities to reduce duplication and improve maintainability.';

	schema = {
		referenceFile: {
			type: z.string().optional(),
			description:
				'Reference file to find similar patterns to (required if referenceSymbol not provided)',
		},
		referenceSymbol: {
			type: z.string().optional(),
			description:
				'Reference symbol to find similar patterns to (required if referenceFile not provided)',
		},
		filterByKind: {
			type: z.string().optional(),
			description:
				'Filter by symbol kind (e.g., "function", "class")',
		},
		filterByParadigm: {
			type: z.string().optional(),
			description:
				'Filter by programming paradigm (e.g., "object-oriented", "functional")',
		},
		filterByModuleType: {
			type: z.string().optional(),
			description:
				'Filter by module type (e.g., "esm", "commonjs")',
		},
		minSimilarity: {
			type: z.coerce.number().min(0).max(1).optional().default(0.7),
			description:
				'Minimum similarity score (0-1, default: 0.7)',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include confidence scores (default: false)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(50),
			description:
				'Maximum number of results to return (default: 50, max: 100)',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Offset for pagination (default: 0)',
		},
	};

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the similar patterns findings for AI-friendly output
	 */
	protected formatResult(
		data: FindSimilarPatternsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { summary, patterns, highPriorityRefactorings } = data;
		const patternsArray = patterns || [];
		const refactoringsArray = highPriorityRefactorings || [];

		let output = `Similar Code Patterns Analysis\n\n`;

		if (!summary || (summary?.totalPatterns || 0) === 0) {
			output += '✅ No significant code duplication found! Your codebase follows DRY principles.\n';
		} else {
			// Summary
			output += `## Summary\n`;
			output += `Patterns Found: ${summary?.totalPatterns || 0}\n`;
			output += `Total Occurrences: ${summary?.totalOccurrences || 0}\n`;
			output += `Potential Line Savings: ~${summary?.potentialLineSavings || 0} lines\n`;

			if (summary?.byType && Object.keys(summary.byType).length > 0) {
				output += `\nBy Type:\n`;
				for (const [type, count] of Object.entries(summary.byType)) {
					output += `  ${type}: ${count}\n`;
				}
			}

			// High priority refactorings
			if (refactoringsArray.length > 0) {
				output += `\n## 🔥 High Priority Refactorings (${refactoringsArray.length})\n`;
				output += `These patterns should be refactored first:\n\n`;

				for (const item of refactoringsArray.slice(0, 5)) {
					const priority = item?.priority || 'MEDIUM';
					const reason = item?.reason || 'No reason provided';
					output += `  ${this.getPriorityEmoji(priority)} ${reason}\n`;
					const pattern = patternsArray.find(p => p?.patternId === item?.patternId);
					if (pattern) {
						output += `     Found in ${pattern?.occurrences?.length || 0} locations, ${pattern?.linesOfCode || 0} lines each\n`;
					}
				}
				output += '\n';
			}

			// Detailed patterns
			output += `## Patterns (${patternsArray.length})\n\n`;

			// Sort by potential savings
			const sorted = [...patternsArray].sort(
				(a, b) =>
					(b?.refactoringOpportunity?.estimatedSavings || 0) -
					(a?.refactoringOpportunity?.estimatedSavings || 0)
			);

			for (const pattern of sorted.slice(0, 10)) {
				const typeEmoji = pattern?.type === 'duplicate' ? '🔴' : '🟡';
				const patternId = pattern?.patternId || 'unknown';
				const type = pattern?.type || 'similar';
				const similarity = pattern?.similarity || 0;
				const linesOfCode = pattern?.linesOfCode || 0;
				const occurrences = pattern?.occurrences || [];
				const opportunity = pattern?.refactoringOpportunity;

				output += `### ${typeEmoji} Pattern ${patternId} (${type})\n`;
				output += `Similarity: ${similarity}%\n`;
				output += `Size: ${linesOfCode} lines\n`;
				output += `Occurrences: ${occurrences.length} locations\n`;
				if (opportunity) {
					output += `Potential Savings: ~${opportunity.estimatedSavings || 0} lines\n`;
					output += `Difficulty: ${opportunity.difficulty || 'MEDIUM'}\n\n`;
					output += `**Suggestion:** ${opportunity.suggestion || 'Consider refactoring'}\n\n`;
				}

				output += `Locations:\n`;
				for (const occurrence of occurrences) {
					const filePath = occurrence?.filePath || 'unknown';
					const startLine = occurrence?.startLine || 0;
					const endLine = occurrence?.endLine || 0;
					output += `  • ${filePath}:${startLine}-${endLine}\n`;
				}

				// Show snippet from first occurrence
				if (occurrences.length > 0 && occurrences[0]?.snippet) {
					output += `\nExample (from first location):\n`;
					output += '```\n';
					const lines = occurrences[0].snippet.split('\n');
					for (const line of lines.slice(0, 10)) {
						output += `${line}\n`;
					}
					if (lines.length > 10) {
						output += `... (${lines.length - 10} more lines)\n`;
					}
					output += '```\n';
				}

				output += '\n';
			}

			if (patternsArray.length > 10) {
				output += `... and ${patternsArray.length - 10} more patterns\n\n`;
			}

			// Refactoring guide
			output += `## 🔧 Refactoring Guide\n\n`;
			output += `### For Duplicate Code (100% similarity):\n`;
			output += `1. Extract to a shared function/class\n`;
			output += `2. Create utility module if not exists\n`;
			output += `3. Replace all occurrences with call to shared code\n`;
			output += `4. Add tests for the extracted function\n\n`;

			output += `### For Similar Code (80-99% similarity):\n`;
			output += `1. Identify the common parts and differences\n`;
			output += `2. Extract common logic with parameters for differences\n`;
			output += `3. Consider strategy pattern if logic varies significantly\n`;
			output += `4. Maintain backward compatibility during refactoring\n\n`;

			output += `### General Tips:\n`;
			output += `- Start with high-similarity, high-occurrence patterns\n`;
			output += `- Refactor in small, testable increments\n`;
			output += `- Ensure tests pass after each refactoring step\n`;
			output += `- Consider introducing interfaces for flexibility\n`;
			output += `- Document the refactored code clearly\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

	private getPriorityEmoji(priority: string): string {
		switch (priority) {
			case 'HIGH':
				return '🔴';
			case 'MEDIUM':
				return '🟡';
			case 'LOW':
				return '🟢';
			default:
				return '⚪';
		}
	}
}

export default FindSimilarPatternsTool;
