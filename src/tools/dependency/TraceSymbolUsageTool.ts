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
	symbolName: string;
	filePath?: string;
	includeImports?: boolean;
	includeReferences?: boolean;
	limit?: number;
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
		'Trace where and how a symbol (function, class, variable) is used across the entire codebase. Shows imports, function calls, references, and usage context.';

	schema = {
		symbolName: {
			type: z.string().min(1),
			description:
				'Name of the symbol to trace (e.g., "UserService", "calculateTotal")',
		},
		filePath: {
			type: z.string().optional(),
			description:
				'Optional: File where symbol is defined (to disambiguate)',
		},
		includeImports: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include import statements (default: true)',
		},
		includeReferences: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include all references and calls (default: true)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(500).optional().default(100),
			description:
				'Maximum number of usages to return (default: 100, max: 500)',
		},
	};

	/**
	 * Override execute to generate symbolId from filePath + symbolName if needed
	 */
	async execute(input: TraceSymbolUsageParams): Promise<string> {
		// If symbolId not provided but filePath and symbolName are, generate it
		if (!input.symbolId && input.filePath && input.symbolName) {
			const symbolId = this.generateSymbolId(input.filePath, input.symbolName);
			input = { ...input, symbolId };
		}

		return super.execute(input);
	}

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
