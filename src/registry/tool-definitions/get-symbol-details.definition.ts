/**
 * Enhanced Tool Definition: get_symbol_details
 *
 * Provides rich metadata for the get_symbol_details tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const getSymbolDetailsDefinition: McpToolDefinition = {
	name: 'get_symbol_details',
	category: 'Discovery',

	description:
		'Get detailed info about a specific symbol (function, class, variable). USER ASKS: "What does X do?", "Show function Y", "What is Z?". Fast (<100ms), includeReferences may take 200-500ms. Use symbolId from search_symbols.',

	shortDescription:
		'Get detailed information about a specific symbol including signature, usage, and relationships',

	whenToUse: [
		'❓ **USER ASKS:** "What is X?", "Show me Y", "What does Z do?", "Where is X defined?"',
		'🔍 You have a symbolId from search_symbols (preferred identification method)',
		'🔍 You know exact symbol name and file path',
		'🔍 Need comprehensive details (definition, signature, documentation)',
		'🔍 Want to see all references/usage locations (with includeReferences=true)',
		'🔍 Analyzing relationships (calls, inheritance, implementations)',
		'🔍 Assessing impact of changing a symbol (with includeImpactScore=true)',
	],

	relatedTools: [
		'search_symbols',
		'contextual_symbol_resolution',
		'trace_symbol_usage',
		'impact_analysis',
		'get_dependencies',
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
					'Can return hundreds of results for widely-used symbols. ' +
					'For detailed usage analysis with code context, use trace_symbol_usage instead.',
			},
			includeRelationships: {
				type: 'boolean',
				default: false,
				description:
					'Include relationships like function calls, inheritance, implementations. Shows: ' +
					'what functions this symbol calls, what functions call it, what classes it extends, ' +
					'what classes extend it, and more. Essential for understanding code architecture and ' +
					'dependencies. Cached results make this reasonably fast.',
			},
			includeImpactScore: {
				type: 'boolean',
				default: false,
				description:
					'Include impact analysis metrics: how many places use this symbol (direct usage), ' +
					'how many depend on it transitively, and a risk score for making changes. ' +
					'Involves graph traversal. Useful when planning refactoring or evaluating symbol importance.',
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
		'❌ MISTAKE: Using for symbol search → ✅ DO: Use search_symbols first to find symbols',
		'❌ MISTAKE: Using for type/import context → ✅ DO: Use contextual_symbol_resolution',
		'❌ MISTAKE: Providing only symbolName without filePath → ✅ DO: Provide both or use symbolId',
		'❌ MISTAKE: includeReferences on popular symbols (1000+ refs) → ✅ DO: Use trace_symbol_usage instead',
		'❌ MISTAKE: Not using symbolId from search_symbols → ✅ DO: Always use symbolId when available',
		'❌ MISTAKE: Enabling all options when you need basic info → ✅ DO: Start minimal, add flags as needed',
	],

	sinceVersion: '0.0.1',
};
