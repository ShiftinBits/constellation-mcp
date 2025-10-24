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
		'Find what depends on a file (reverse/backward dependencies): which files import or use this target. Impact analysis for changes. ' +
		'Use depth parameter to control traversal (1=direct, 2-3=transitive dependents). ' +
		'For forward direction (what this depends on), use get_dependencies.',

	shortDescription: 'Find what files depend on this file (reverse dependencies)',

	whenToUse: [
		'Understanding the impact of modifying or removing a file',
		'Finding all consumers of an API or utility function',
		'Identifying highly-coupled code by counting dependents',
		'Checking if a file is safe to delete (zero dependents)',
		'Understanding module usage patterns',
	],

	relatedTools: ['get_dependencies', 'impact_analysis', 'trace_symbol_usage', 'find_orphaned_code'],

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
				description:
					'How many levels deep to traverse the dependents tree (default: 1, max: 10). ' +
					'⚠️ EXPONENTIAL GROWTH: depth=1 might return 10 dependents, depth=2 returns 100, depth=3 returns 1000+. ' +
					'depth=1: Only direct dependents (files that directly import this file). ' +
					'depth=2: Dependents of dependents (2 levels deep). ' +
					'depth=3+: Deeper transitive dependents (use cautiously). ' +
					'Start with default (1), only increase for complete impact analysis.',
			},
			includeSymbols: {
				type: 'boolean',
				default: false,
				description:
					'Include details about which specific symbols from the file are being used by each dependent. ' +
					'Shows what functions/classes/variables are actually imported. Increases response size.',
			},
			includeImpactMetrics: {
				type: 'boolean',
				default: false,
				description:
					'Include detailed impact metrics: usage counts, criticality scores, risk assessment. ' +
					'Useful for understanding importance and blast radius of changes.',
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

	sinceVersion: '0.0.1',
};
