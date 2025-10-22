/**
 * Find Orphaned Code Tool
 *
 * MCP tool for finding code that is never used or imported (dead code)
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatLocation } from '../../utils/format-helpers.js';

interface FindOrphanedCodeParams {
	directory?: string;
	includeTests?: boolean;
	minConfidence?: number;
}

interface OrphanedItem {
	type: 'file' | 'symbol';
	name: string;
	filePath: string;
	line?: number;
	reason: string;
	confidence: number;
}

interface FindOrphanedCodeResult {
	orphanedFiles: OrphanedItem[];
	orphanedSymbols: OrphanedItem[];
	totalOrphaned: number;
	potentialSavings: {
		files: number;
		linesOfCode: number;
	};
}

class FindOrphanedCodeTool extends BaseMcpTool<
	FindOrphanedCodeParams,
	FindOrphanedCodeResult
> {
	name = 'find_orphaned_code';
	description =
		'Find code that is never used or imported (dead code). Helps identify files and symbols that can be safely removed to reduce codebase size and complexity.';

	schema = {
		directory: {
			type: z.string().optional(),
			description:
				'Optional: Limit search to a specific directory (e.g., "src/components")',
		},
		includeTests: {
			type: z.boolean().optional().default(false),
			description: 'Include test files in analysis (default: false)',
		},
		minConfidence: {
			type: z.number().min(0).max(100).optional().default(80),
			description:
				'Minimum confidence level for orphaned code detection (default: 80%)',
		},
	};

	/**
	 * Format the orphaned code findings for AI-friendly output
	 */
	protected formatResult(
		data: FindOrphanedCodeResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { orphanedFiles, orphanedSymbols, totalOrphaned, potentialSavings } = data;

		let output = `Orphaned Code Analysis\n\n`;

		if (totalOrphaned === 0) {
			output += '✅ No orphaned code found! Your codebase is clean.';
		} else {
			output += `Found ${totalOrphaned} orphaned ${totalOrphaned === 1 ? 'item' : 'items'}\n`;
			output += `Potential savings: ${potentialSavings.files} files, ~${potentialSavings.linesOfCode} lines of code\n\n`;

			// Orphaned files
			if (orphanedFiles.length > 0) {
				output += `## 🗑️  Orphaned Files (${orphanedFiles.length})\n`;
				output += 'These files are not imported anywhere:\n\n';

				// Sort by confidence
				const sorted = [...orphanedFiles].sort((a, b) => b.confidence - a.confidence);

				for (const file of sorted.slice(0, 20)) {
					output += `  ${file.filePath}\n`;
					output += `    ${file.reason}\n`;
					output += `    Confidence: ${file.confidence}%\n\n`;
				}

				if (orphanedFiles.length > 20) {
					output += `  ... and ${orphanedFiles.length - 20} more files\n\n`;
				}
			}

			// Orphaned symbols
			if (orphanedSymbols.length > 0) {
				output += `## 🔹 Orphaned Symbols (${orphanedSymbols.length})\n`;
				output += 'These exported symbols are never imported:\n\n';

				// Group by file
				const byFile = new Map<string, OrphanedItem[]>();
				for (const symbol of orphanedSymbols) {
					if (!byFile.has(symbol.filePath)) {
						byFile.set(symbol.filePath, []);
					}
					byFile.get(symbol.filePath)!.push(symbol);
				}

				let count = 0;
				for (const [filePath, symbols] of Array.from(byFile.entries()).slice(0, 10)) {
					output += `  ${filePath}:\n`;
					for (const symbol of symbols) {
						output += `    - ${symbol.name}`;
						if (symbol.line) {
							output += ` (line ${symbol.line})`;
						}
						output += ` - ${symbol.confidence}% confidence\n`;
					}
					output += '\n';
					count++;
				}

				if (byFile.size > 10) {
					output += `  ... and ${byFile.size - 10} more files with orphaned symbols\n\n`;
				}
			}

			output += `## ⚠️  Before Removing\n`;
			output += `1. Verify these items are truly unused (check dynamic imports)\n`;
			output += `2. Search for string-based references (e.g., configuration files)\n`;
			output += `3. Consider if code is used in production but not in tests\n`;
			output += `4. Create a feature branch to safely test removal\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default FindOrphanedCodeTool;
