/**
 * Enhanced Tool Definition: analyze_breaking_changes
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const analyzeBreakingChangesDefinition: McpToolDefinition = {
	name: 'analyze_breaking_changes',
	category: 'Impact',

	description:
		'Detect potential breaking changes when modifying public APIs, contracts, or interfaces. Analyzes ' +
		'what will break if you change function signatures, rename exports, or modify types. Provides ' +
		'migration guidance and identifies all affected call sites.',

	shortDescription: 'Detect breaking changes to public APIs',

	whenToUse: [
		'Planning API changes and need to understand compatibility impact',
		'Changing function signatures or method parameters',
		'Renaming or removing exported symbols',
		'Refactoring public interfaces',
		'Preparing API migration guides',
	],

	relatedTools: ['analyze_change_impact', 'trace_symbol_usage', 'impact_analysis', 'get_symbol_details'],

	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description: 'Path to file containing the symbol to analyze.',
			},
			symbolName: {
				type: 'string',
				description: 'Specific symbol to analyze (optional with autoDetect mode).',
			},
			autoDetect: {
				type: 'boolean',
				default: true,
				description: 'Automatically analyze all exported symbols in the file.',
			},
			changes: {
				type: 'array',
				description: 'Specific changes to analyze (optional).',
			},
			includeSuggestions: {
				type: 'boolean',
				default: true,
				description: 'Include migration suggestions and remediation steps.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description: 'Include confidence scores for breaking change detection.',
			},
		},
		required: ['filePath'],
	},

	examples: [
		{
			title: 'Analyze file for breaking changes',
			description: 'Check all exported APIs in a file for potential breaks',
			parameters: {
				filePath: 'src/api/users.ts',
				autoDetect: true,
				includeSuggestions: true,
			},
			expectedOutcome: 'Returns analysis of all public APIs with breaking change risks and migration guidance.',
		},
		{
			title: 'Analyze specific symbol change',
			description: 'Check impact of changing a specific function',
			parameters: {
				filePath: 'src/services/auth.service.ts',
				symbolName: 'authenticate',
				autoDetect: false,
				includeSuggestions: true,
			},
			expectedOutcome: 'Returns breaking change analysis for authenticate function with suggestions.',
		},
		{
			title: 'Quick breaking change check',
			description: 'Fast check without detailed suggestions',
			parameters: {
				filePath: 'src/utils/helpers.ts',
				autoDetect: true,
				includeSuggestions: false,
			},
			expectedOutcome: 'Returns list of potential breaking changes without migration guidance.',
		},
	],

	commonMistakes: [
		'Not checking exported symbols before making changes',
		'Ignoring migration suggestions - they help consumers adapt',
	],

	performanceNotes: [
		'Auto-detect mode analyzes all exports (may take 2-3 seconds for large files)',
		'Single symbol analysis is much faster',
		'Results cached for 10 minutes',
	],

	sinceVersion: '0.0.1',
};
