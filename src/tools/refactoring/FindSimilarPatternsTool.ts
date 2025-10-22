/**
 * Find Similar Patterns Tool
 *
 * MCP tool for finding duplicate or similar code patterns that could be refactored
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface FindSimilarPatternsParams {
	filePath?: string;
	minSimilarity?: number;
	minSize?: number;
	includeTests?: boolean;
	patternType?: 'function' | 'class' | 'block' | 'all';
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
		filePath: {
			type: z.string().optional(),
			description:
				'Optional: Limit search to specific file or directory (e.g., "src/services")',
		},
		minSimilarity: {
			type: z.number().min(0).max(100).optional().default(80),
			description:
				'Minimum similarity percentage to report (default: 80)',
		},
		minSize: {
			type: z.number().min(3).optional().default(5),
			description:
				'Minimum number of lines for a pattern (default: 5)',
		},
		includeTests: {
			type: z.boolean().optional().default(false),
			description: 'Include test files in analysis (default: false)',
		},
		patternType: {
			type: z
				.enum(['function', 'class', 'block', 'all'])
				.optional()
				.default('all'),
			description:
				'Type of patterns to search for (default: all)',
		},
	};

	/**
	 * Format the similar patterns findings for AI-friendly output
	 */
	protected formatResult(
		data: FindSimilarPatternsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { summary, patterns, highPriorityRefactorings } = data;

		let output = `Similar Code Patterns Analysis\n\n`;

		if (summary.totalPatterns === 0) {
			output += '✅ No significant code duplication found! Your codebase follows DRY principles.\n';
		} else {
			// Summary
			output += `## Summary\n`;
			output += `Patterns Found: ${summary.totalPatterns}\n`;
			output += `Total Occurrences: ${summary.totalOccurrences}\n`;
			output += `Potential Line Savings: ~${summary.potentialLineSavings} lines\n`;

			if (Object.keys(summary.byType).length > 0) {
				output += `\nBy Type:\n`;
				for (const [type, count] of Object.entries(summary.byType)) {
					output += `  ${type}: ${count}\n`;
				}
			}

			// High priority refactorings
			if (highPriorityRefactorings.length > 0) {
				output += `\n## 🔥 High Priority Refactorings (${highPriorityRefactorings.length})\n`;
				output += `These patterns should be refactored first:\n\n`;

				for (const item of highPriorityRefactorings.slice(0, 5)) {
					output += `  ${this.getPriorityEmoji(item.priority)} ${item.reason}\n`;
					const pattern = patterns.find(p => p.patternId === item.patternId);
					if (pattern) {
						output += `     Found in ${pattern.occurrences.length} locations, ${pattern.linesOfCode} lines each\n`;
					}
				}
				output += '\n';
			}

			// Detailed patterns
			output += `## Patterns (${patterns.length})\n\n`;

			// Sort by potential savings
			const sorted = [...patterns].sort(
				(a, b) =>
					b.refactoringOpportunity.estimatedSavings -
					a.refactoringOpportunity.estimatedSavings
			);

			for (const pattern of sorted.slice(0, 10)) {
				const typeEmoji = pattern.type === 'duplicate' ? '🔴' : '🟡';
				output += `### ${typeEmoji} Pattern ${pattern.patternId} (${pattern.type})\n`;
				output += `Similarity: ${pattern.similarity}%\n`;
				output += `Size: ${pattern.linesOfCode} lines\n`;
				output += `Occurrences: ${pattern.occurrences.length} locations\n`;
				output += `Potential Savings: ~${pattern.refactoringOpportunity.estimatedSavings} lines\n`;
				output += `Difficulty: ${pattern.refactoringOpportunity.difficulty}\n\n`;

				output += `**Suggestion:** ${pattern.refactoringOpportunity.suggestion}\n\n`;

				output += `Locations:\n`;
				for (const occurrence of pattern.occurrences) {
					output += `  • ${occurrence.filePath}:${occurrence.startLine}-${occurrence.endLine}\n`;
				}

				// Show snippet from first occurrence
				if (pattern.occurrences[0].snippet) {
					output += `\nExample (from first location):\n`;
					output += '```\n';
					const lines = pattern.occurrences[0].snippet.split('\n');
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

			if (patterns.length > 10) {
				output += `... and ${patterns.length - 10} more patterns\n\n`;
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
