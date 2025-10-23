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
			type: z.coerce.boolean().optional().default(false),
			description: 'Include test files in analysis (default: false)',
		},
		minConfidence: {
			type: z.coerce.number().min(0).max(100).optional().default(80),
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
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		// Backend DTO uses orphanedFiles[] and orphanedSymbols[] directly
		const { orphanedFiles, orphanedSymbols } = data;

		const filesArray = orphanedFiles || [];
		const symbolsArray = orphanedSymbols || [];
		const totalOrphaned = filesArray.length + symbolsArray.length;

		let output = `Orphaned Code Analysis\n\n`;

		if (totalOrphaned === 0) {
			output += '✅ No orphaned code found! Your codebase is clean.';
		} else {
			output += `Found ${totalOrphaned} orphaned ${totalOrphaned === 1 ? 'item' : 'items'}\n\n`;

			// Orphaned files
			if (filesArray.length > 0) {
				output += `## 🗑️ Orphaned Files (${filesArray.length})\n`;
				output += 'These files are not imported anywhere:\n\n';

				// Sort by confidence descending
				const sorted = [...filesArray].sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0));

				for (const file of sorted.slice(0, 20)) {
					output += `  ${file?.filePath || 'unknown'}\n`;
					if (file?.reason) {
						output += `    ${file.reason}\n`;
					}
					const confidence = file?.confidence ? Math.round(file.confidence * 100) : 0;
					output += `    Confidence: ${confidence}%\n`;
					if (file?.lastUpdated) {
						output += `    Last Updated: ${file.lastUpdated}\n`;
					}
					output += '\n';
				}

				if (filesArray.length > 20) {
					output += `  ... and ${filesArray.length - 20} more files\n\n`;
				}
			}

			// Orphaned symbols
			if (symbolsArray.length > 0) {
				output += `## 🔹 Orphaned Symbols (${symbolsArray.length})\n`;
				output += 'These exported symbols are never imported:\n\n';

				// Group by file
				const byFile = new Map<string, typeof symbolsArray>();
				for (const symbol of symbolsArray) {
					const filePath = symbol?.filePath || 'unknown';
					if (!byFile.has(filePath)) {
						byFile.set(filePath, []);
					}
					byFile.get(filePath)!.push(symbol);
				}

				for (const [filePath, symbols] of Array.from(byFile.entries()).slice(0, 10)) {
					output += `  ${filePath}:\n`;
					for (const symbol of symbols) {
						const name = symbol?.name || 'unknown';
						const kind = symbol?.kind || '';
						output += `    - ${name}`;
						if (kind) {
							output += ` (${kind})`;
						}
						const confidence = symbol?.confidence ? Math.round(symbol.confidence * 100) : 0;
						output += ` - ${confidence}% confidence`;
						if (symbol?.isExported) {
							output += ' (exported)';
						}
						output += '\n';
					}
					output += '\n';
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
