/**
 * Get Call Graph Tool
 *
 * MCP tool for generating a call graph showing function invocation relationships
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatLocation } from '../../utils/format-helpers.js';

interface GetCallGraphParams {
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
			type: z.number().int().min(1).max(5).optional().default(3),
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
	 * Format the call graph for AI-friendly output
	 */
	protected formatResult(
		data: GetCallGraphResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { rootFunction, nodes, edges, totalCalls } = data;

		let output = `Call Graph Analysis\n\n`;

		if (rootFunction) {
			output += `Root Function: ${rootFunction.name}\n`;
			output += `Location: ${formatLocation(rootFunction.filePath, rootFunction.line)}\n`;
			output += `Type: ${rootFunction.kind}\n\n`;
		}

		output += `Total nodes: ${nodes.length}\n`;
		output += `Total call relationships: ${totalCalls}\n\n`;

		if (edges.length === 0) {
			output += 'No call relationships found.';
		} else {
			// Build adjacency lists
			const callees = new Map<string, CallGraphEdge[]>();
			const callers = new Map<string, CallGraphEdge[]>();

			for (const edge of edges) {
				if (!callees.has(edge.from)) {
					callees.set(edge.from, []);
				}
				callees.get(edge.from)!.push(edge);

				if (!callers.has(edge.to)) {
					callers.set(edge.to, []);
				}
				callers.get(edge.to)!.push(edge);
			}

			// Show what this function calls
			if (rootFunction && callees.has(rootFunction.name)) {
				const calls = callees.get(rootFunction.name)!;
				output += `## ${rootFunction.name} calls (${calls.length}):\n`;
				for (const edge of calls) {
					output += `  → ${edge.to}\n`;
					output += `    at ${formatLocation(edge.callSite.filePath, edge.callSite.line)}\n`;
				}
				output += '\n';
			}

			// Show what calls this function
			if (rootFunction && callers.has(rootFunction.name)) {
				const calls = callers.get(rootFunction.name)!;
				output += `## Called by (${calls.length}):\n`;
				for (const edge of calls) {
					output += `  ← ${edge.from}\n`;
					output += `    at ${formatLocation(edge.callSite.filePath, edge.callSite.line)}\n`;
				}
				output += '\n';
			}

			// If no root function, show most connected functions
			if (!rootFunction) {
				output += `## Most Connected Functions:\n`;
				const connectionCounts = new Map<string, number>();

				for (const edge of edges) {
					connectionCounts.set(
						edge.from,
						(connectionCounts.get(edge.from) || 0) + 1
					);
					connectionCounts.set(
						edge.to,
						(connectionCounts.get(edge.to) || 0) + 1
					);
				}

				const sorted = Array.from(connectionCounts.entries())
					.sort(([, a], [, b]) => b - a)
					.slice(0, 10);

				for (const [func, count] of sorted) {
					const node = nodes.find((n) => n.name === func);
					output += `  ${func} (${count} connections)`;
					if (node) {
						output += ` - ${formatLocation(node.filePath, node.line)}`;
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
