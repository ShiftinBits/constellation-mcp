/**
 * Enhanced Tool Definition: get_symbol_details
 *
 * Provides rich metadata for the get_symbol_details tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getSymbolDetailsDefinition: McpToolDefinition = {
	name: 'get_symbol_details',
	category: 'Discovery',

	description:
		'Get comprehensive information about a specific symbol including its definition, signature, ' +
		'documentation, dependencies, dependents, and all usage locations. Use this tool when you ' +
		'need to understand a symbol deeply - what it does, how it\'s used, what it depends on, and ' +
		'what depends on it. First use search_symbols to find the symbol, then use this tool to get ' +
		'complete details.',

	shortDescription:
		'Get detailed information about a specific symbol including signature, usage, and relationships',

	whenToUse: [
		'Understanding what a specific function, class, or variable does and how it works',
		'Finding all places where a symbol is referenced or called',
		'Discovering a symbol\'s dependencies and what code depends on it',
		'Analyzing inheritance relationships for a class or interface',
		'Reviewing a symbol\'s documentation and signature before using it',
	],

	relatedTools: [
		'search_symbols',
		'trace_symbol_usage',
		'analyze_change_impact',
		'get_dependencies',
		'get_dependents',
	],

	inputSchema: {
		type: 'object',
		properties: {
			symbolId: {
				type: 'string',
				description:
					'Unique symbol identifier returned by search_symbols. This is the preferred and most ' +
					'precise way to identify a symbol. Format: base64-encoded hash. Use this when you have ' +
					'the symbol ID from a previous search. If not provided, both symbolName and filePath are required.',
			},
			symbolName: {
				type: 'string',
				description:
					'Name of the symbol to look up (e.g., "UserService", "calculateTotal", "API_KEY"). ' +
					'Required if symbolId not provided. Must be combined with filePath to uniquely identify ' +
					'the symbol, since multiple symbols with the same name may exist across the codebase.',
			},
			filePath: {
				type: 'string',
				description:
					'Relative path to the file containing the symbol (e.g., "src/services/user.service.ts"). ' +
					'Required if symbolId not provided. Must be combined with symbolName to uniquely identify ' +
					'the symbol. Use the exact path returned by search_symbols for accuracy.',
			},
			includeReferences: {
				type: 'boolean',
				default: false,
				description:
					'Include all locations where this symbol is referenced or imported. This shows every ' +
					'place in the codebase that uses this symbol, with file paths and line numbers. ' +
					'Very useful for understanding usage patterns but increases response size. ' +
					'For detailed usage analysis, consider using trace_symbol_usage instead.',
			},
			includeRelationships: {
				type: 'boolean',
				default: false,
				description:
					'Include relationships like function calls, inheritance, implementations. Shows: ' +
					'what functions this symbol calls, what functions call it, what classes it extends, ' +
					'what classes extend it, and more. Essential for understanding code architecture and ' +
					'dependencies.',
			},
			includeImpactScore: {
				type: 'boolean',
				default: false,
				description:
					'Include impact analysis metrics: how many places use this symbol (direct usage), ' +
					'how many depend on it transitively, and a risk score for making changes. ' +
					'Useful when planning refactoring or evaluating the importance of a symbol.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Get symbol details by ID',
			description:
				'Retrieve complete details for a symbol using its ID from search results',
			parameters: {
				symbolId: 'abc123def456',
				includeReferences: true,
				includeRelationships: true,
			},
			expectedOutcome:
				'Returns full symbol information: type, location, signature, documentation, ' +
				'all reference locations, function calls, inheritance relationships. ' +
				'This is the most complete view of a symbol.',
		},
		{
			title: 'Get symbol details by name and file',
			description:
				'Look up a symbol when you know its name and file location',
			parameters: {
				symbolName: 'UserService',
				filePath: 'src/services/user.service.ts',
				includeRelationships: true,
				includeImpactScore: true,
			},
			expectedOutcome:
				'Returns symbol details including what methods UserService has, what it depends on, ' +
				'what depends on it, and impact metrics. No references included to keep response focused.',
		},
		{
			title: 'Quick symbol lookup without extras',
			description:
				'Get basic information about a symbol - definition, signature, and documentation only',
			parameters: {
				symbolName: 'calculateTotal',
				filePath: 'src/utils/math.ts',
			},
			expectedOutcome:
				'Returns just the essential information: where the symbol is defined, ' +
				'its signature (parameters and return type), and any documentation. ' +
				'Fast response useful for quick reference.',
		},
	],

	commonMistakes: [
		'Providing only symbolName without filePath - this is ambiguous if multiple symbols share the name',
		'Requesting includeReferences for highly-used symbols - can return hundreds of results; use trace_symbol_usage for better filtering',
		'Not using symbolId when available - symbolId is more precise and faster than name+file lookup',
		'Enabling all options (references, relationships, impact) when you only need basic info - increases response time significantly',
	],

	performanceNotes: [
		'Lookup by symbolId is faster than by name+filePath',
		'Including references for widely-used symbols (e.g., utility functions) can return large result sets',
		'Relationships are computed on-demand but cached for 5 minutes',
		'Impact scores involve graph traversal and are the slowest option to compute',
	],

	sinceVersion: '0.0.1',
};
