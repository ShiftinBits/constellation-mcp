/**
 * Find Orphaned Code Tool
 *
 * MCP tool for finding code that is never used or imported (dead code)
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
import {
	FindOrphanedCodeParams,
	FindOrphanedCodeResult,
} from '../../types/api-types.js';
import { section, emphasize, collapsedHint, numberedList } from '../../utils/format-helpers.js';
import { MARKERS, getFileMarkers, applyMarkers } from '../../utils/semantic-markers.js';

class FindOrphanedCodeTool extends BaseMcpTool<
	FindOrphanedCodeParams,
	FindOrphanedCodeResult
> {
	name = 'find_orphaned_code';
	description =
		'Find code that is never used or imported (dead code). Helps identify files and symbols that can be safely removed to reduce codebase size and complexity. ' +
		'**PAGINATION**: Supports limit/offset with default of 50. Use for comprehensive dead code analysis. ' +
		'Increase limit (75-100) for large cleanup initiatives to see full scope of orphaned code.';

	schema = {
		filePattern: {
			type: z.string().optional(),
			description:
				'File path pattern to limit search (e.g., "src/components/**")',
		},
		filterByKind: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by symbol kind (e.g., ["function", "class", "variable"])',
		},
		exportedOnly: {
			type: z.coerce.boolean().optional().default(true),
			description:
				'Only analyze exported symbols (default: true)',
		},
		includeReasons: {
			type: z.coerce.boolean().optional().default(true),
			description:
				'Include reasons why code is orphaned (default: true)',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include confidence scores (default: false)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(50),
			description:
				'Maximum number of orphaned items to return per page (default: 50, max: 100). Use 75-100 for comprehensive cleanup analysis to minimize pagination rounds.',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Starting position for pagination (default: 0). Useful for exploring large amounts of dead code. Example: limit=50, offset=50 gets items 51-100.',
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

		const allFiles = orphanedFiles || [];
		const allSymbols = orphanedSymbols || [];

		// Separate test files from actual orphaned files
		const isTestFile = (filePath: string): boolean => {
			return (
				filePath.includes('/test/') ||
				filePath.includes('.test.') ||
				filePath.includes('.spec.') ||
				filePath.includes('/__tests__/') ||
				filePath.includes('/__mocks__/') ||
				filePath.includes('/tests/') ||
				filePath.endsWith('.test.ts') ||
				filePath.endsWith('.test.js') ||
				filePath.endsWith('.spec.ts') ||
				filePath.endsWith('.spec.js')
			);
		};

		const testFiles = allFiles.filter((f) => isTestFile(f?.filePath || ''));
		const filesArray = allFiles.filter((f) => !isTestFile(f?.filePath || ''));

		const testSymbols = allSymbols.filter((s) => isTestFile(s?.filePath || ''));
		const symbolsArray = allSymbols.filter((s) => !isTestFile(s?.filePath || ''));

		const totalOrphaned = filesArray.length + symbolsArray.length;

		let output = `${section('Orphaned Code Analysis', 1)}\n\n`;

		if (totalOrphaned === 0 && testFiles.length === 0 && testSymbols.length === 0) {
			output += `${MARKERS.SAFE} No orphaned code found! Your codebase is clean.`;
		} else {
			if (totalOrphaned > 0) {
				output += `${MARKERS.UNUSED} Found ${totalOrphaned} orphaned ${totalOrphaned === 1 ? 'item' : 'items'}\n\n`;
			}

			// Orphaned files
			if (filesArray.length > 0) {
				output += `${section('Orphaned Files', 2)} (${filesArray.length})\n`;
				output += 'These files are not imported anywhere:\n\n';

				// Sort by confidence descending
				const sorted = [...filesArray].sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0));

				for (const file of sorted.slice(0, 20)) {
					const filePath = file?.filePath || 'unknown';
					const fileMarkers = getFileMarkers(filePath);
					const fileDisplay = fileMarkers.length > 0 ? applyMarkers(fileMarkers, filePath) : filePath;

					output += `  ${fileDisplay}\n`;
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
					output += `  ${collapsedHint(filesArray.length, 20)}\n\n`;
				}
			}

			// Orphaned symbols
			if (symbolsArray.length > 0) {
				output += `${section('Orphaned Symbols', 2)} (${symbolsArray.length})\n`;
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
					const fileMarkers = getFileMarkers(filePath);
					const fileDisplay = fileMarkers.length > 0 ? applyMarkers(fileMarkers, filePath) : filePath;

					output += `  ${fileDisplay}:\n`;
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
							output += ` ${MARKERS.EXPORTED}`;
						}
						output += '\n';
					}
					output += '\n';
				}

				if (byFile.size > 10) {
					output += `  ${collapsedHint(byFile.size, 10)} files with orphaned symbols\n\n`;
				}
			}

			// Show test files in separate section
			if (testFiles.length > 0 || testSymbols.length > 0) {
				output += `${section('Test Files (Expected)', 2)}\n`;
				output += `Test files typically have no production dependencies. This is normal behavior.\n\n`;

				if (testFiles.length > 0) {
					output += `Found ${testFiles.length} test ${testFiles.length === 1 ? 'file' : 'files'}:\n\n`;
					for (const file of testFiles.slice(0, 10)) {
						const filePath = file?.filePath || 'unknown';
						const fileMarkers = getFileMarkers(filePath);
						const fileDisplay = fileMarkers.length > 0 ? applyMarkers(fileMarkers, filePath) : filePath;
						output += `  [TEST] ${fileDisplay}\n`;
					}
					if (testFiles.length > 10) {
						output += `\n  ${collapsedHint(testFiles.length, 10)}\n`;
					}
					output += '\n';
				}

				if (testSymbols.length > 0) {
					output += `Found ${testSymbols.length} test ${testSymbols.length === 1 ? 'symbol' : 'symbols'}\n\n`;
				}
			}

			if (totalOrphaned > 0) {
				const removalSteps = [
					'Verify these items are truly unused (check dynamic imports)',
					'Search for string-based references (e.g., configuration files)',
					'Consider if code is used in production but not in tests',
					'Create a feature branch to safely test removal',
				];
				output += `${section('Before Removing')}\n${numberedList(removalSteps)}\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default FindOrphanedCodeTool;
