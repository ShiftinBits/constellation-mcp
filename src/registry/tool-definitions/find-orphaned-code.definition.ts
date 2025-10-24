/**
 * Enhanced Tool Definition: find_orphaned_code
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const findOrphanedCodeDefinition: McpToolDefinition = {
	name: 'find_orphaned_code',
	category: 'Impact',

	description:
		'Find code that is never used or imported (dead code). Identifies exported symbols with zero references and files with no dependents. ' +
		'Use exportedOnly=true to focus on public APIs. Provides confidence scores and reasons why code is orphaned. ' +
		'TYPICAL WORKFLOW: Find candidates here → Verify with trace_symbol_usage → Check impact with impact_analysis before deletion.',

	shortDescription: 'Find unused code that can be safely removed',

	whenToUse: [
		'Cleaning up dead code and unused exports',
		'Reducing codebase size and complexity',
		'Preparing for a major refactoring',
		'Auditing what public APIs are actually used',
		'Finding candidates for deprecation',
	],

	relatedTools: ['impact_analysis', 'trace_symbol_usage', 'get_dependents', 'analyze_package_usage'],

	inputSchema: {
		type: 'object',
		properties: {
			exportedOnly: {
				type: 'boolean',
				default: true,
				description:
					'Only analyze exported symbols (default: true, RECOMMENDED). ' +
					'Internal/private symbols are expected to be unused within their files. ' +
					'Set to false to find ALL unused symbols, but expect many false positives. ' +
					'Example: exportedOnly=true finds unused public APIs, exportedOnly=false finds all unused code.',
			},
			filePattern: {
				type: 'string',
				description:
					'Limit search to files matching glob pattern. ' +
					'Examples: "src/utils/**" (all utils), "**/components/**/*.tsx" (all components), "src/api/**" (API layer). ' +
					'Omit to search entire codebase.',
			},
			filterByKind: {
				type: 'array',
				items: { type: 'string' },
				description:
					'Filter by symbol kind. Valid values: ["function"], ["class"], ["variable"], ["interface"], ["type"], ["enum"]. ' +
					'Example: filterByKind=["function"] finds only unused functions. ' +
					'Omit to find all symbol types.',
			},
			includeReasons: {
				type: 'boolean',
				default: true,
				description:
					'Include reasons why code is considered orphaned (default: true, RECOMMENDED). ' +
					'Provides context like "No references found" or "File has no dependents". ' +
					'Set to false for faster queries if you only need the list.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description:
					'Include confidence scores (0-1) for orphan detection (default: false). ' +
					'High confidence (0.9+) = definitely unused, low confidence (0.5-0.7) = possibly used via dynamic imports. ' +
					'Use this when you need to prioritize what to delete first.',
			},
			limit: {
				type: 'number',
				default: 50,
				maximum: 100,
				description: 'Maximum results to return per page (default: 50, max: 100). Use with offset for pagination.',
			},
			offset: {
				type: 'number',
				default: 0,
				description: 'Offset for pagination (default: 0). Example: offset=50 gets results 51-100.',
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

	sinceVersion: '0.0.1',
};
