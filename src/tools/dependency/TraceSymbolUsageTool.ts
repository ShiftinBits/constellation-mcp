/**
 * Trace Symbol Usage Tool
 *
 * MCP tool for tracing where and how a symbol is used across the entire codebase
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatLocation } from '../../utils/format-helpers.js';

interface TraceSymbolUsageParams {
	symbolId?: string;
	symbolName?: string;
	filePath?: string;
	filterByUsageType?: string[];
	filterByRelationshipType?: string[];
	includeTransitive?: boolean;
	includeContext?: boolean;
	excludeTests?: boolean;
	excludeGenerated?: boolean;
	includeImportanceWeight?: boolean;
	limit?: number;
	offset?: number;
}

interface SymbolUsage {
	filePath: string;
	line: number;
	column?: number;
	usageType: string;
	context?: string;
}

interface TraceSymbolUsageResult {
	symbol: {
		name: string;
		definedIn: string;
		kind: string;
	};
	usages: SymbolUsage[];
	totalUsages: number;
	usagesByType: Record<string, number>;
}

class TraceSymbolUsageTool extends BaseMcpTool<
	TraceSymbolUsageParams,
	TraceSymbolUsageResult
> {
	name = 'trace_symbol_usage';
	description =
		'Trace where and how a symbol (function, class, variable) is used across the entire codebase. Shows imports, function calls, references, and usage context. ' +
		'**PAGINATION**: Supports limit/offset with generous default of 50 (max: 500 for comprehensive tracing). Use pagination for heavily-used symbols to avoid overwhelming responses. ' +
		'Start with default, increase limit for exhaustive analysis.';

	schema = {
		symbolId: {
			type: z.string().optional(),
			description: 'Unique symbol ID (alternative to symbolName)',
		},
		symbolName: {
			type: z.string().optional(),
			description:
				'Name of the symbol to trace (e.g., "UserService", "calculateTotal")',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'File where symbol is defined (optional, improves precision when multiple symbols have same name)',
		},
		filterByUsageType: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by symbol kind (e.g., ["function", "class"])',
		},
		filterByRelationshipType: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by relationship type (e.g., ["REFERENCES", "CALLS", "INHERITS"])',
		},
		includeTransitive: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include transitive (indirect) usages (default: false)',
		},
		includeContext: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include enclosing symbol context (default: true)',
		},
		excludeTests: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Exclude test files from results (default: false)',
		},
		excludeGenerated: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Exclude generated files from results (default: false)',
		},
		includeImportanceWeight: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include importance weighting in results (default: false)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(500).optional().default(50),
			description:
				'Maximum number of usages to return per page (default: 50, max: 500). Higher limit (100-500) for comprehensive usage analysis of critical symbols. Note: This tool has higher max (500) than most tools.',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Starting position for pagination (default: 0). Increment by limit for next page. Example: limit=100, offset=100 gets usages 101-200.',
		},
	};

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the symbol usage trace for AI-friendly output
	 */
	protected formatResult(
		data: TraceSymbolUsageResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data || !data.symbol) {
			return 'Error: No symbol data returned from API';
		}

		// Backend DTO uses: symbol, directUsages, transitiveUsages
		const { symbol, directUsages, transitiveUsages } = data as any;
		const usages = directUsages || [];
		const transitive = transitiveUsages || [];

		let output = `Symbol Usage Trace: ${symbol?.name || 'unknown'}\n\n`;
		output += `Defined in: ${symbol?.filePath || 'unknown'}\n`;
		output += `Type: ${symbol?.kind || 'unknown'}\n`;
		output += `Total direct usages: ${usages.length}\n`;
		if (transitive.length > 0) {
			output += `Total transitive usages: ${transitive.length}\n`;
		}
		output += '\n';

		// Calculate breakdown by usage type
		const usagesByType: Record<string, number> = {};
		for (const usage of usages) {
			const type = usage?.usageType || 'unknown';
			usagesByType[type] = (usagesByType[type] || 0) + 1;
		}

		if (Object.keys(usagesByType).length > 0) {
			output += `## Usage Breakdown:\n`;
			for (const [type, count] of Object.entries(usagesByType).sort(
				([, a], [, b]) => b - a
			)) {
				output += `  ${type}: ${count}\n`;
			}
			output += '\n';
		}

		// Show usage locations
		if (usages.length > 0) {
			output += `## Direct Usage Locations (${usages.length}):\n\n`;

			// Group by file
			const usagesByFile = new Map<string, typeof usages>();
			for (const usage of usages) {
				const filePath = usage?.filePath || 'unknown';
				if (!usagesByFile.has(filePath)) {
					usagesByFile.set(filePath, []);
				}
				usagesByFile.get(filePath)!.push(usage);
			}

			// Display grouped by file
			for (const [filePath, fileUsages] of usagesByFile.entries()) {
				output += `### ${filePath} (${fileUsages.length} ${fileUsages.length === 1 ? 'usage' : 'usages'})\n`;
				for (const usage of fileUsages) {
					const line = usage?.line || 0;
					const column = usage?.column;
					const usageType = usage?.usageType || 'reference';
					output += `  ${formatLocation(filePath, line, column)} - ${usageType}`;
					if (usage?.relationshipType) {
						output += ` (${usage.relationshipType})`;
					}
					if (usage?.context) {
						output += `\n    Context: ${usage.context}`;
					}
					if (usage?.enclosingSymbol) {
						output += `\n    In: ${usage.enclosingSymbol.name} (${usage.enclosingSymbol.kind})`;
					}
					output += '\n';
				}
				output += '\n';
			}
		} else {
			output += 'No direct usages found. This symbol may be unused (orphaned code).\n';
		}

		// Transitive usages
		if (transitive.length > 0) {
			output += `\n## Transitive Usage (${transitive.length}):\n`;
			output += `Files that indirectly depend on this symbol:\n\n`;
			for (const trans of transitive.slice(0, 20)) {
				output += `  ${trans?.filePath || 'unknown'} (distance: ${trans?.distance || 0})\n`;
				if (trans?.chain && trans.chain.length > 0) {
					output += `    Chain: ${trans.chain.join(' → ')}\n`;
				}
			}
			if (transitive.length > 20) {
				output += `  ... and ${transitive.length - 20} more\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default TraceSymbolUsageTool;
