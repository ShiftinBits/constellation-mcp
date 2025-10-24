/**
 * Enhanced Tool Definition: find_orphaned_code
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const findOrphanedCodeDefinition: McpToolDefinition = {
	name: 'find_orphaned_code',
	category: 'Impact',

	description:
		'Find code that is never used or imported - dead code that can be safely removed. Identifies ' +
		'exported symbols with zero references and files with no dependents. Use this to reduce codebase ' +
		'size, improve maintainability, and eliminate confusion from unused APIs.',

	shortDescription: 'Find unused code that can be safely removed',

	whenToUse: [
		'Cleaning up dead code and unused exports',
		'Reducing codebase size and complexity',
		'Preparing for a major refactoring',
		'Auditing what public APIs are actually used',
		'Finding candidates for deprecation',
	],

	relatedTools: ['analyze_change_impact', 'trace_symbol_usage', 'get_dependents', 'analyze_package_usage'],

	inputSchema: {
		type: 'object',
		properties: {
			exportedOnly: {
				type: 'boolean',
				default: true,
				description: 'Only analyze exported symbols (recommended - internal symbols expected to be unused).',
			},
			filePattern: {
				type: 'string',
				description: 'Limit search to files matching pattern (e.g., "src/utils/**").',
			},
			filterByKind: {
				type: 'array',
				items: { type: 'string' },
				description: 'Filter by symbol kind: ["function"], ["class"], etc.',
			},
			includeReasons: {
				type: 'boolean',
				default: true,
				description: 'Include reasons why code is considered orphaned.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description: 'Include confidence scores.',
			},
			limit: {
				type: 'number',
				default: 50,
				maximum: 100,
				description: 'Maximum results to return.',
			},
			offset: {
				type: 'number',
				default: 0,
				description: 'Offset for pagination.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Find unused exports',
			description: 'Identify all exported symbols with zero usage',
			parameters: {
				exportedOnly: true,
				includeReasons: true,
				limit: 50,
			},
			expectedOutcome: 'Returns exported functions/classes/variables that are never imported anywhere.',
		},
		{
			title: 'Find unused utilities',
			description: 'Check for dead code in utils directory',
			parameters: {
				filePattern: 'src/utils/**',
				exportedOnly: true,
				filterByKind: ['function'],
			},
			expectedOutcome: 'Returns unused utility functions that can be deleted.',
		},
		{
			title: 'Find unused classes',
			description: 'Locate classes that are never instantiated or extended',
			parameters: {
				filterByKind: ['class'],
				exportedOnly: true,
				includeReasons: true,
			},
			expectedOutcome: 'Returns classes with zero usage that are safe to remove.',
		},
	],

	commonMistakes: [
		'Not using exportedOnly filter - gets many false positives from internal helpers',
		'Deleting code without verifying it\'s truly unused - double-check results',
		'Not considering dynamic imports or runtime usage',
	],

	performanceNotes: [
		'Full codebase scan takes 3-5 seconds',
		'File pattern filtering significantly improves speed',
		'Results cached for 30 minutes',
	],

	sinceVersion: '0.0.1',
};
