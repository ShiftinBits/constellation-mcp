/**
 * Get Call Graph Tool
 *
 * MCP tool for generating a call graph showing function invocation relationships
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatLocation } from '../../utils/format-helpers.js';

interface GetCallGraphParams {
	symbolId?: string;
	functionName?: string;
	filePath?: string;
	depth?: number;
	direction?: 'callers' | 'callees' | 'both';
}

interface CallGraphNode {
	name: string;
	filePath: string;
	line: number;
	kind: string;
}

interface CallGraphEdge {
	from: string;
	to: string;
	callSite: {
		filePath: string;
		line: number;
	};
}

interface GetCallGraphResult {
	rootFunction: CallGraphNode;
	nodes: CallGraphNode[];
	edges: CallGraphEdge[];
	totalCalls: number;
}

class GetCallGraphTool extends BaseMcpTool<
	GetCallGraphParams,
	GetCallGraphResult
> {
	name = 'get_call_graph';
	description =
		'Generate a call graph showing function invocation relationships. Shows which functions call which, helping understand execution flow and dependencies.';

	schema = {
		functionName: {
			type: z.string().optional(),
			description:
				'Function name to analyze (omit to get full project call graph)',
		},
		filePath: {
			type: z.string().optional(),
			description: 'File path to narrow down search',
		},
		depth: {
			type: z.coerce.number().int().min(1).max(5).optional().default(3),
			description:
				'How many levels deep to traverse (default: 3, max: 5)',
		},
		direction: {
			type: z.enum(['callers', 'callees', 'both']).optional().default('both'),
			description:
				'Direction: "callers" (who calls this), "callees" (what this calls), or "both" (default: both)',
		},
	};

	/**
	 * Override execute to generate symbolId from filePath + functionName if needed
	 */
	async execute(input: GetCallGraphParams): Promise<string> {
		// If symbolId not provided but filePath and functionName are, generate it
		if (!input.symbolId && input.filePath && input.functionName) {
			const symbolId = this.generateSymbolId(input.filePath, input.functionName);
			input = { ...input, symbolId };
		}

		return super.execute(input);
	}

	/**
	 * Format the call graph for AI-friendly output
	 */
	protected formatResult(
		data: GetCallGraphResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { rootFunction, nodes, edges, totalCalls } = data;
		const nodesArray = nodes || [];
		const edgesArray = edges || [];
		const total = totalCalls || 0;

		let output = `Call Graph Analysis\n\n`;

		if (rootFunction) {
			output += `Root Function: ${rootFunction.name || 'unknown'}\n`;
			output += `Location: ${formatLocation(rootFunction.filePath || 'unknown', rootFunction.line || 0)}\n`;
			output += `Type: ${rootFunction.kind || 'function'}\n\n`;
		}

		output += `Total nodes: ${nodesArray.length}\n`;
		output += `Total call relationships: ${total}\n\n`;

		if (edgesArray.length === 0) {
			output += 'No call relationships found.';
		} else {
			// Build adjacency lists
			const callees = new Map<string, CallGraphEdge[]>();
			const callers = new Map<string, CallGraphEdge[]>();

			for (const edge of edgesArray) {
				const from = edge?.from || 'unknown';
				const to = edge?.to || 'unknown';

				if (!callees.has(from)) {
					callees.set(from, []);
				}
				callees.get(from)!.push(edge);

				if (!callers.has(to)) {
					callers.set(to, []);
				}
				callers.get(to)!.push(edge);
			}

			// Show what this function calls
			if (rootFunction && callees.has(rootFunction.name)) {
				const calls = callees.get(rootFunction.name)!;
				output += `## ${rootFunction.name} calls (${calls.length}):\n`;
				for (const edge of calls) {
					const to = edge?.to || 'unknown';
					const callSite = edge?.callSite;
					output += `  → ${to}\n`;
					if (callSite) {
						output += `    at ${formatLocation(callSite.filePath || 'unknown', callSite.line || 0)}\n`;
					}
				}
				output += '\n';
			}

			// Show what calls this function
			if (rootFunction && callers.has(rootFunction.name)) {
				const calls = callers.get(rootFunction.name)!;
				output += `## Called by (${calls.length}):\n`;
				for (const edge of calls) {
					const from = edge?.from || 'unknown';
					const callSite = edge?.callSite;
					output += `  ← ${from}\n`;
					if (callSite) {
						output += `    at ${formatLocation(callSite.filePath || 'unknown', callSite.line || 0)}\n`;
					}
				}
				output += '\n';
			}

			// If no root function, show most connected functions
			if (!rootFunction) {
				output += `## Most Connected Functions:\n`;
				const connectionCounts = new Map<string, number>();

				for (const edge of edgesArray) {
					const from = edge?.from || 'unknown';
					const to = edge?.to || 'unknown';
					connectionCounts.set(
						from,
						(connectionCounts.get(from) || 0) + 1
					);
					connectionCounts.set(
						to,
						(connectionCounts.get(to) || 0) + 1
					);
				}

				const sorted = Array.from(connectionCounts.entries())
					.sort(([, a], [, b]) => b - a)
					.slice(0, 10);

				for (const [func, count] of sorted) {
					const node = nodesArray.find((n) => n?.name === func);
					output += `  ${func} (${count} connections)`;
					if (node) {
						output += ` - ${formatLocation(node.filePath || 'unknown', node.line || 0)}`;
					}
					output += '\n';
				}
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetCallGraphTool;
