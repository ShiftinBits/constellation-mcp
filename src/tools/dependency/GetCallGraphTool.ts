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
	direction?: 'callers' | 'callees' | 'both';
	depth?: number;
	excludeExternal?: boolean;
	includeGraph?: boolean;
}

// Mirrors constellation-core/apps/client-api/src/mcp/dto/get-call-graph.dto.ts
interface CallGraphRoot {
	symbolId: string;
	name: string;
	filePath: string;
}

interface CallerNode {
	symbolId: string;
	name: string;
	filePath: string;
	depth: number;
}

interface CalleeNode {
	symbolId: string;
	name: string;
	filePath: string;
	isAsync: boolean;
	depth: number;
}

interface GraphRepresentation {
	nodes: Array<{ id: string; name: string; filePath: string }>;
	edges: Array<{ from: string; to: string }>;
}

interface GetCallGraphResult {
	root: CallGraphRoot;
	callers?: CallerNode[];
	callees?: CalleeNode[];
	graph?: GraphRepresentation;
}

class GetCallGraphTool extends BaseMcpTool<
	GetCallGraphParams,
	GetCallGraphResult
> {
	name = 'get_call_graph';
	description =
		'Generate a call graph showing function invocation relationships. Shows which functions call which, helping understand execution flow and dependencies.';

	schema = {
		symbolId: {
			type: z.string().optional(),
			description: 'Unique symbol ID (alternative to functionName)',
		},
		functionName: {
			type: z.string().optional(),
			description:
				'Function name to analyze (omit to get full project call graph)',
		},
		filePath: {
			type: z.string().optional(),
			description: 'File path to narrow down search',
		},
		direction: {
			type: z.enum(['callers', 'callees', 'both']).optional().default('both'),
			description:
				'Direction: "callers" (who calls this), "callees" (what this calls), or "both" (default: both)',
		},
		depth: {
			type: z.coerce.number().int().min(1).max(10).optional().default(3),
			description:
				'How many levels deep to traverse (default: 3, max: 10)',
		},
		excludeExternal: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Exclude external/library calls (default: false)',
		},
		includeGraph: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include graph visualization data (default: false)',
		},
	};

	// No parameter transformation needed - direct passthrough to API

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

		const { root, callers, callees, graph } = data;

		let output = `Call Graph Analysis\n\n`;

		// Root function info
		if (root) {
			output += `Root Function: ${root.name}\n`;
			output += `Location: ${formatLocation(root.filePath, 0)}\n`;
			output += `Symbol ID: ${root.symbolId}\n\n`;
		}

		// Count total nodes and edges
		const callersArray = callers || [];
		const calleesArray = callees || [];
		const totalNodes = 1 + callersArray.length + calleesArray.length; // root + callers + callees
		const totalEdges = callersArray.length + calleesArray.length;

		output += `Total nodes: ${totalNodes}\n`;
		output += `Total call relationships: ${totalEdges}\n\n`;

		if (callersArray.length === 0 && calleesArray.length === 0) {
			output += 'No call relationships found.';
		} else {
			// Show callees (what this function calls)
			if (calleesArray.length > 0) {
				output += `## ${root.name} calls (${calleesArray.length}):\n`;

				// Group by depth
				const calleesByDepth = new Map<number, CalleeNode[]>();
				for (const callee of calleesArray) {
					const depth = callee.depth || 1;
					if (!calleesByDepth.has(depth)) {
						calleesByDepth.set(depth, []);
					}
					calleesByDepth.get(depth)!.push(callee);
				}

				// Sort depths and display
				const depths = Array.from(calleesByDepth.keys()).sort((a, b) => a - b);
				for (const depth of depths) {
					const nodes = calleesByDepth.get(depth)!;
					output += `\n### Depth ${depth} (${nodes.length} calls):\n`;
					for (const callee of nodes) {
						const asyncMarker = callee.isAsync ? ' (async)' : '';
						output += `  → ${callee.name}${asyncMarker}\n`;
						output += `    ${formatLocation(callee.filePath, 0)}\n`;
					}
				}
				output += '\n';
			}

			// Show callers (what calls this function)
			if (callersArray.length > 0) {
				output += `## Called by (${callersArray.length}):\n`;

				// Group by depth
				const callersByDepth = new Map<number, CallerNode[]>();
				for (const caller of callersArray) {
					const depth = caller.depth || 1;
					if (!callersByDepth.has(depth)) {
						callersByDepth.set(depth, []);
					}
					callersByDepth.get(depth)!.push(caller);
				}

				// Sort depths and display
				const depths = Array.from(callersByDepth.keys()).sort((a, b) => a - b);
				for (const depth of depths) {
					const nodes = callersByDepth.get(depth)!;
					output += `\n### Depth ${depth} (${nodes.length} callers):\n`;
					for (const caller of nodes) {
						output += `  ← ${caller.name}\n`;
						output += `    ${formatLocation(caller.filePath, 0)}\n`;
					}
				}
				output += '\n';
			}

			// Show graph if included
			if (graph && graph.nodes && graph.edges) {
				output += `## Graph Representation:\n`;
				output += `Nodes: ${graph.nodes.length}\n`;
				output += `Edges: ${graph.edges.length}\n\n`;

				if (graph.edges.length > 0) {
					output += `### Call Relationships:\n`;
					for (const edge of graph.edges.slice(0, 20)) { // Limit to first 20
						output += `  ${edge.from} → ${edge.to}\n`;
					}
					if (graph.edges.length > 20) {
						output += `  ... and ${graph.edges.length - 20} more\n`;
					}
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
