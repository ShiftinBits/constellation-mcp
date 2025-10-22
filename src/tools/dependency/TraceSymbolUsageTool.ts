/**
 * Trace Symbol Usage Tool
 *
 * MCP tool for tracing where and how a symbol is used across the entire codebase
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatLocation } from '../../utils/format-helpers.js';

interface TraceSymbolUsageParams {
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
			type: z.boolean().optional().default(true),
			description: 'Include import statements (default: true)',
		},
		includeReferences: {
			type: z.boolean().optional().default(true),
			description: 'Include all references and calls (default: true)',
		},
		limit: {
			type: z.number().int().min(1).max(500).optional().default(100),
			description:
				'Maximum number of usages to return (default: 100, max: 500)',
		},
	};

	/**
	 * Format the symbol usage trace for AI-friendly output
	 */
	protected formatResult(
		data: TraceSymbolUsageResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { symbol, usages, totalUsages, usagesByType } = data;

		let output = `Symbol Usage Trace: ${symbol.name}\n\n`;
		output += `Defined in: ${symbol.definedIn}\n`;
		output += `Type: ${symbol.kind}\n`;
		output += `Total usages: ${totalUsages}\n\n`;

		// Show breakdown by usage type
		if (usagesByType && Object.keys(usagesByType).length > 0) {
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
			output += `## Usage Locations (showing ${usages.length} of ${totalUsages}):\n\n`;

			// Group by file
			const usagesByFile = new Map<string, SymbolUsage[]>();
			for (const usage of usages) {
				if (!usagesByFile.has(usage.filePath)) {
					usagesByFile.set(usage.filePath, []);
				}
				usagesByFile.get(usage.filePath)!.push(usage);
			}

			// Display grouped by file
			for (const [filePath, fileUsages] of usagesByFile.entries()) {
				output += `### ${filePath} (${fileUsages.length} ${fileUsages.length === 1 ? 'usage' : 'usages'})\n`;
				for (const usage of fileUsages) {
					output += `  ${formatLocation(filePath, usage.line, usage.column)} - ${usage.usageType}`;
					if (usage.context) {
						output += `\n    Context: ${usage.context}`;
					}
					output += '\n';
				}
				output += '\n';
			}

			if (totalUsages > usages.length) {
				output += `\n(${totalUsages - usages.length} more usages not shown)\n`;
			}
		} else {
			output += 'No usages found. This symbol may be unused (orphaned code).';
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default TraceSymbolUsageTool;
