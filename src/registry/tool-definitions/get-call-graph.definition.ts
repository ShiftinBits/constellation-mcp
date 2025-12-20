/**
 * Enhanced Tool Definition: get_call_graph
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const getCallGraphDefinition: McpToolDefinition = {
	name: 'get_call_graph',
	category: 'Dependency',

	description:
		'Generate call graph showing function relationships. USER ASKS: "Show call graph", "What calls this?", "Visualize execution flow". depth=1 <50ms, depth=3 <200ms. direction: callers/callees/both. excludeExternal removes library calls.',

	shortDescription:
		'Generate call graph showing function invocation relationships',

	whenToUse: [
		'**USER ASKS:** "Show call graph", "What calls this function?", "Visualize execution flow", "What does X call?", "Trace call chain"',
		'Understanding execution flow through a codebase',
		'Finding all functions that call a specific function',
		'Discovering the full call chain for debugging',
		'Analyzing function dependencies before refactoring',
		'Tracing code execution paths',
	],

	relatedTools: [
		'trace_symbol_usage',
		'get_symbol_details',
		'get_dependencies',
	],

	triggerPhrases: [
		'show call graph',
		'what calls this function',
		'execution flow',
		'what does X call',
		'call hierarchy',
		'trace call chain',
		'visualize function calls',
		'show callers',
	],

	inputSchema: {
		type: 'object',
		properties: {
			symbolName: {
				type: 'string',
				description:
					'Symbol name to analyze (function, method, class). Omit to get full project call graph.',
			},
			filePath: {
				type: 'string',
				description:
					'File path to narrow down search if symbol name is ambiguous.',
			},
			symbolId: {
				type: 'string',
				description: 'Unique symbol ID (alternative to symbolName).',
			},
			direction: {
				type: 'string',
				enum: ['callers', 'callees', 'both'],
				default: 'both',
				description:
					'Direction to traverse the call graph (default: both): ' +
					'"callers": Who calls this function (backward traversal, find usage). ' +
					'"callees": What this function calls (forward traversal, understand execution). ' +
					'"both": Complete picture (bidirectional, most comprehensive).',
			},
			depth: {
				type: 'number',
				minimum: 1,
				maximum: 10,
				default: 3,
				description:
					'How many levels deep to traverse the call chain (default: 3, max: 10). ' +
					'⚠️ EXPONENTIAL GROWTH: depth=1 shows direct calls, depth=2 shows calls of calls, etc. ' +
					'depth=3 (default) provides good balance between detail and performance. ' +
					'Higher values reveal complete call chains but may take longer and return many results.',
			},
			excludeExternal: {
				type: 'boolean',
				default: false,
				description:
					'Exclude external/library calls (default: false). ' +
					'When true, shows only internal project function calls, hiding calls to npm packages, standard library, etc. ' +
					"Useful for focusing on your code's execution flow without noise from framework/library internals.",
			},
			includeGraph: {
				type: 'boolean',
				default: false,
				description:
					'Include graph visualization data (nodes, edges, graph structure). ' +
					'Useful if you want to render a visual call graph. Increases response size. ' +
					'Set to false for simple list of call relationships.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Find who calls a function',
			description: 'See all callers of a specific function',
			parameters: {
				symbolName: 'processPayment',
				filePath: 'src/services/payment.service.ts',
				direction: 'callers',
				depth: 2,
			},
			expectedOutcome:
				'Returns all functions that call processPayment, 2 levels deep.',
		},
		{
			title: 'Trace function call chain',
			description: 'See what a function calls and what calls it',
			parameters: {
				symbolName: 'validateUser',
				direction: 'both',
				depth: 3,
				excludeExternal: true,
			},
			expectedOutcome:
				'Returns full call graph showing callers and callees, excluding library calls.',
		},
		{
			title: 'Project-wide call graph',
			description: 'Get overview of function calls across project',
			parameters: {
				depth: 1,
				excludeExternal: true,
			},
			expectedOutcome:
				'Returns top-level call relationships across the entire project.',
		},
	],

	commonMistakes: [
		'MISTAKE: Starting with depth=5+ on first query → DO: Use depth=3 (default) first, then increase only if needed',
		'MISTAKE: Including external library calls when analyzing internal code → DO: Set excludeExternal=true to focus on your codebase',
		'MISTAKE: Using direction="both" when you only need callers → DO: Use direction="callers" or "callees" to reduce result size by ~50%',
	],

	sinceVersion: '0.0.1',
};
