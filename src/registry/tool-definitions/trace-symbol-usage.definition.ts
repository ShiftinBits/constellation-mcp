/**
 * Enhanced Tool Definition: trace_symbol_usage
 *
 * Provides rich metadata for the trace_symbol_usage tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const traceSymbolUsageDefinition: McpToolDefinition = {
	name: 'trace_symbol_usage',
	category: 'Dependency',

	description:
		'Trace how a symbol is used with code context. USER ASKS: "How is X used?", "Show all callers", "Where is this referenced?". Fast <100ms for 50 results. Filter by type (CALLS/IMPORTS), exclude tests. includeContext shows HOW used, not just WHERE.',

	shortDescription:
		'Trace all usages of a symbol across the codebase with detailed context',

	whenToUse: [
		'**USER ASKS:** "How is X used?", "Show me all callers of this function", "Where is Y referenced?", "What depends on this class?", "Show usage patterns"',
		'Finding all places where a function is called or a class is instantiated',
		'Understanding how an API is being used across the codebase before changing it',
		'Identifying usage patterns to guide refactoring decisions',
		'Locating dead code by checking if a symbol has zero usages',
		'Filtering usage by type (calls vs imports vs inheritance) for specific analysis',
	],

	relatedTools: [
		'get_symbol_details',
		'impact_analysis',
		'find_orphaned_code',
		'search_symbols',
		'get_call_graph',
	],

	inputSchema: {
		type: 'object',
		properties: {
			symbolId: {
				type: 'string',
				description:
					'Unique symbol identifier from search_symbols results. Most precise way to identify ' +
					'the symbol. Use this when you have the ID. If not provided, both symbolName and ' +
					'filePath should be provided for disambiguation.',
			},
			symbolName: {
				type: 'string',
				description:
					'Name of the symbol to trace (e.g., "UserService", "calculateTotal", "API_BASE_URL"). ' +
					'If multiple symbols share this name, combine with filePath to disambiguate. ' +
					'Required if symbolId not provided.',
			},
			filePath: {
				type: 'string',
				description:
					'File where the symbol is defined (e.g., "src/services/user.service.ts"). ' +
					'Helps disambiguate when multiple symbols have the same name. Recommended to provide ' +
					'along with symbolName for accuracy.',
			},
			filterByUsageType: {
				type: 'array',
				items: {
					type: 'string',
					enum: ['function', 'class', 'variable', 'type', 'interface'],
				},
				description:
					'Filter by the kind of usage. Rarely needed - this filters the symbol type, not how it\'s used. ' +
					'Most users want filterByRelationshipType instead.',
			},
			filterByRelationshipType: {
				type: 'array',
				items: {
					type: 'string',
					enum: ['REFERENCES', 'CALLS', 'IMPORTS', 'INHERITS', 'IMPLEMENTS', 'INSTANTIATES'],
				},
				description:
					'Filter by how the symbol is used. Very useful for focused analysis: ' +
					'["CALLS"] shows only function calls, ["IMPORTS"] shows only imports, ' +
					'["INHERITS", "IMPLEMENTS"] shows only inheritance/implementation. ' +
					'Combine multiple types as needed. Omit to see all relationship types.',
			},
			includeTransitive: {
				type: 'boolean',
				default: false,
				description:
					'Include transitive (indirect) usages. When true, finds not just direct usage but also ' +
					'files that depend on files that use this symbol (the ripple effect). Useful for understanding ' +
					'full impact but returns many more results. Most use cases want false (direct usage only).',
			},
			includeContext: {
				type: 'boolean',
				default: true,
				description:
					'Include context about where each usage occurs: the enclosing function/class, surrounding code. ' +
					'Highly recommended (default: true) - helps understand HOW the symbol is being used, not just WHERE. ' +
					'This is the unique value of this tool over get_symbol_details. ' +
					'Disable only if you need just file locations and line numbers.',
			},
			excludeTests: {
				type: 'boolean',
				default: false,
				description:
					'Exclude test files from results. Set to true when you want to see production usage only, ' +
					'ignoring test code. Set to false (default) to include all usages including tests.',
			},
			excludeGenerated: {
				type: 'boolean',
				default: false,
				description:
					'Exclude generated files (build artifacts, auto-generated code) from results. ' +
					'Usually a good idea to enable this to focus on actual source code.',
			},
			includeImportanceWeight: {
				type: 'boolean',
				default: false,
				description:
					'Include importance weighting scores for each usage. ' +
					'Helps prioritize which usages matter most. ' +
					'Include importance weighting for each usage location based on how critical that code is. ' +
					'Useful for prioritizing which usages to focus on during refactoring.',
			},
			limit: {
				type: 'number',
				minimum: 1,
				maximum: 500,
				default: 50,
				description:
					'Maximum number of usage locations to return. Default 50 is good for most cases. ' +
					'Increase up to 500 for comprehensive analysis of heavily-used symbols. Use pagination ' +
					'(offset) for very large result sets.',
			},
			offset: {
				type: 'number',
				minimum: 0,
				default: 0,
				description:
					'Skip this many results for pagination. Combine with limit to page through large usage lists.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Find all callers of a function',
			description:
				'Locate every place in the codebase where a function is called',
			parameters: {
				symbolName: 'calculateTotal',
				filePath: 'src/utils/math.ts',
				filterByRelationshipType: ['CALLS'],
				includeContext: true,
				excludeTests: false,
			},
			expectedOutcome:
				'Returns all function call sites with context showing how calculateTotal is being called, ' +
				'including arguments and surrounding logic. Groups results by file. Shows both production ' +
				'and test usage.',
		},
		{
			title: 'Find all imports of a utility',
			description:
				'See which files import a specific utility function or class',
			parameters: {
				symbolId: 'abc123def456',
				filterByRelationshipType: ['IMPORTS'],
				excludeTests: true,
				excludeGenerated: true,
			},
			expectedOutcome:
				'Returns only import statements (not actual usage) in production code, excluding tests and ' +
				'generated files. Useful for understanding adoption of an API or preparing deprecation notices.',
		},
		{
			title: 'Comprehensive usage analysis',
			description:
				'Get complete picture of how a class is used everywhere',
			parameters: {
				symbolName: 'UserService',
				filePath: 'src/services/user.service.ts',
				includeTransitive: true,
				includeContext: true,
				includeImportanceWeight: true,
				limit: 100,
			},
			expectedOutcome:
				'Returns all direct usages (imports, instantiations, method calls) plus transitive dependencies, ' +
				'with full context and importance scores. Shows complete impact of the class with up to 100 results. ' +
				'Most comprehensive analysis option.',
		},
	],

	commonMistakes: [
		'MISTAKE: Using filterByUsageType to filter how symbols are used → DO: Use filterByRelationshipType (["CALLS"], ["IMPORTS"], etc.)',
		'MISTAKE: Always setting excludeTests=true when user wants to see ALL usages → DO: Use excludeTests=false (default) to include all code; only use excludeTests=true when specifically analyzing production impact',
		'MISTAKE: Setting includeContext=false to reduce data → DO: Keep includeContext=true (default) - context is the primary value of this tool',
		'MISTAKE: Using includeTransitive=true for simple usage checks → DO: Use includeTransitive=false (default) unless you need ripple effect analysis',
	],

	sinceVersion: '0.0.1',
};
