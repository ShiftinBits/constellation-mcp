/**
 * Enhanced Tool Definition: get_call_graph
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getCallGraphDefinition: McpToolDefinition = {
	name: 'get_call_graph',
	category: 'Dependency',

	description:
		'Generate a call graph showing function invocation relationships - which functions call which others. ' +
		'Shows execution flow and helps understand how code paths work. Can show callers (who calls this function), ' +
		'callees (what this function calls), or both directions.',

	shortDescription: 'Generate call graph showing function invocation relationships',

	whenToUse: [
		'Understanding execution flow through a codebase',
		'Finding all functions that call a specific function',
		'Discovering the full call chain for debugging',
		'Analyzing function dependencies before refactoring',
		'Tracing code execution paths',
	],

	relatedTools: ['trace_symbol_usage', 'get_symbol_details', 'get_dependencies', 'find_entry_points'],

	inputSchema: {
		type: 'object',
		properties: {
			functionName: {
				type: 'string',
				description: 'Function name to analyze. Omit to get full project call graph.',
			},
			filePath: {
				type: 'string',
				description: 'File path to narrow down search if function name is ambiguous.',
			},
			symbolId: {
				type: 'string',
				description: 'Unique symbol ID (alternative to functionName).',
			},
			direction: {
				type: 'string',
				enum: ['callers', 'callees', 'both'],
				default: 'both',
				description: 'Direction: "callers" (who calls this), "callees" (what this calls), or "both".',
			},
			depth: {
				type: 'number',
				minimum: 1,
				maximum: 10,
				default: 3,
				description: 'How many levels deep to traverse. Higher values show more of the call chain.',
			},
			excludeExternal: {
				type: 'boolean',
				default: false,
				description: 'Exclude external/library calls.',
			},
			includeGraph: {
				type: 'boolean',
				default: false,
				description: 'Include graph visualization data.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Find who calls a function',
			description: 'See all callers of a specific function',
			parameters: {
				functionName: 'processPayment',
				filePath: 'src/services/payment.service.ts',
				direction: 'callers',
				depth: 2,
			},
			expectedOutcome: 'Returns all functions that call processPayment, 2 levels deep.',
		},
		{
			title: 'Trace function call chain',
			description: 'See what a function calls and what calls it',
			parameters: {
				functionName: 'validateUser',
				direction: 'both',
				depth: 3,
				excludeExternal: true,
			},
			expectedOutcome: 'Returns full call graph showing callers and callees, excluding library calls.',
		},
		{
			title: 'Project-wide call graph',
			description: 'Get overview of function calls across project',
			parameters: {
				depth: 1,
				excludeExternal: true,
			},
			expectedOutcome: 'Returns top-level call relationships across the entire project.',
		},
	],

	commonMistakes: [
		'Using high depth (>4) on initial queries - returns overwhelming results',
		'Not excluding external calls when focused on internal logic',
	],

	performanceNotes: [
		'Full project call graphs are expensive - prefer specific functions',
		'Depth significantly impacts performance (exponential growth)',
		'Results cached for 15 minutes',
	],

	sinceVersion: '0.0.1',
};
