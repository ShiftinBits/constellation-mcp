/**
 * Enhanced Tool Definition: get_dependents
 *
 * Provides rich metadata for the get_dependents tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getDependentsDefinition: McpToolDefinition = {
	name: 'get_dependents',
	category: 'Dependency',

	description:
		'Find what depends on a file - which files import or use it (reverse dependencies). ' +
		'Shows the backward dependency graph: what code needs this file? Use this to understand ' +
		'the impact scope of changes or to find consumers of an API. For forward dependencies ' +
		'(what does this file need), use get_dependencies instead.',

	shortDescription: 'Find what files depend on this file (reverse dependencies)',

	whenToUse: [
		'Understanding the impact of modifying or removing a file',
		'Finding all consumers of an API or utility function',
		'Identifying highly-coupled code by counting dependents',
		'Checking if a file is safe to delete (zero dependents)',
		'Understanding module usage patterns',
	],

	relatedTools: ['get_dependencies', 'analyze_change_impact', 'trace_symbol_usage', 'find_orphaned_code'],

	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description: 'Path to the file to analyze (e.g., "src/utils/helpers.ts"). Required.',
			},
			depth: {
				type: 'number',
				minimum: 1,
				maximum: 10,
				default: 1,
				description: 'Depth of transitive dependents to analyze. depth=1 shows direct dependents only.',
			},
			includeSymbols: {
				type: 'boolean',
				default: false,
				description: 'Include details about which specific symbols from the file are being used.',
			},
			includeImpactMetrics: {
				type: 'boolean',
				default: false,
				description: 'Include impact metrics: usage counts, criticality scores.',
			},
		},
		required: ['filePath'],
	},

	examples: [
		{
			title: 'Find direct dependents',
			description: 'See what files directly import from a utility module',
			parameters: {
				filePath: 'src/utils/date.ts',
				depth: 1,
			},
			expectedOutcome: 'Returns all files that directly import from date.ts.',
		},
		{
			title: 'Deep dependent analysis',
			description: 'Find all transitive dependents with impact metrics',
			parameters: {
				filePath: 'src/core/config.ts',
				depth: 3,
				includeImpactMetrics: true,
			},
			expectedOutcome: 'Returns dependents 3 levels deep with impact scores showing criticality.',
		},
		{
			title: 'Check if file is unused',
			description: 'Verify if a file has zero dependents before deleting',
			parameters: {
				filePath: 'src/legacy/old-helper.ts',
				depth: 1,
			},
			expectedOutcome: 'Returns empty list if no dependents, confirming safe to delete.',
		},
	],

	commonMistakes: [
		'Confusing get_dependents (who uses this) with get_dependencies (what does this use)',
		'Using high depth on widely-used files - returns overwhelming results',
		'Not checking dependents before deleting code',
	],

	performanceNotes: [
		'Direct dependents (depth=1) are very fast',
		'Each depth level adds graph traversal time',
		'Results cached for 10 minutes',
	],

	sinceVersion: '0.0.1',
};
