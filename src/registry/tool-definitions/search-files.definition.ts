/**
 * Enhanced Tool Definition: search_files
 *
 * Provides rich metadata for the search_files tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const searchFilesDefinition: McpToolDefinition = {
	name: 'search_files',
	category: 'Discovery',

	description:
		'Search for files by name or path pattern using glob syntax. USER ASKS: "Find file X", "Show test files", "Where are components?". Fast glob search <300ms. Use get_file_details for analysis.',

	shortDescription: 'Find files by name or path pattern',

	whenToUse: [
		'❓ **USER ASKS:** "Find file X", "Where is Y?", "Show me all test files", "List components"',
		'🔍 Locating a file when you know part of its name or path',
		'🔍 Finding all files of a specific type (e.g., all .test.ts files)',
		'🔍 Exploring project structure and organization',
		'🔍 Finding files in a specific directory or module',
		'🔍 Identifying entry points or configuration files',
	],

	relatedTools: ['get_file_details', 'search_symbols', 'find_entry_points', 'get_architecture_overview'],

	inputSchema: {
		type: 'object',
		properties: {
			pathPattern: {
				type: 'string',
				description:
					'File path pattern to search for using glob syntax. ' +
					'Examples: "**/*.test.ts" (all test files), "src/components/**" (all in components), ' +
					'"**/User*" (files starting with User). Omit to return all files with filters applied.',
			},
			filterByLanguage: {
				type: 'array',
				items: { type: 'string' },
				description:
					'Filter by programming language. Examples: ["typescript", "javascript"], ["python"], ["go"]. ' +
					'Use this to narrow results to specific language files.',
			},
			filterByModuleType: {
				type: 'array',
				items: { type: 'string', enum: ['esm', 'commonjs'] },
				description: 'Filter by module system: "esm" (ES modules), "commonjs" (require/exports).',
			},
			filterByParadigm: {
				type: 'array',
				items: { type: 'string' },
				description: 'Filter by programming paradigm: "object-oriented", "functional", etc.',
			},
			filterByDomain: {
				type: 'string',
				description: 'Filter by domain/purpose: "api", "ui", "data", "test", etc.',
			},
			isTest: {
				type: 'boolean',
				description: 'Filter to only test files (true) or only non-test files (false). Omit for both.',
			},
			isEntryPoint: {
				type: 'boolean',
				description: 'Filter to only entry point files (true) or non-entry points (false).',
			},
			includeMetrics: {
				type: 'boolean',
				default: false,
				description: 'Include file metrics (complexity, size, symbol counts). Pre-computed, minimal overhead.',
			},
			limit: {
				type: 'number',
				minimum: 1,
				maximum: 100,
				default: 50,
				description: 'Maximum number of results to return. Default 50, max 100.',
			},
			offset: {
				type: 'number',
				minimum: 0,
				default: 0,
				description: 'Offset for pagination.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Find test files',
			description: 'Locate all test files in the project',
			parameters: {
				pathPattern: '**/*.test.ts',
				includeMetrics: false,
			},
			expectedOutcome: 'Returns all TypeScript test files with paths and basic metadata.',
		},
		{
			title: 'Find component files',
			description: 'Find all React component files in src/components',
			parameters: {
				pathPattern: 'src/components/**/*.tsx',
				filterByLanguage: ['typescript'],
				includeMetrics: true,
			},
			expectedOutcome: 'Returns all TSX component files with metrics like complexity and symbol count.',
		},
		{
			title: 'Find entry points',
			description: 'Locate all application entry point files',
			parameters: {
				isEntryPoint: true,
				includeMetrics: true,
			},
			expectedOutcome: 'Returns main application entry files with their metrics and locations.',
		},
	],

	commonMistakes: [
		'❌ MISTAKE: Using overly broad patterns without filters → ✅ DO: Add language or domain filters',
		'❌ MISTAKE: Forgetting glob syntax (using * instead of **/) → ✅ DO: Use **/ for recursive search',
		'❌ MISTAKE: Not filtering tests when you want production code → ✅ DO: Set isTest=false',
		'❌ MISTAKE: Using for symbol search → ✅ DO: Use search_symbols for finding code symbols',
	],

	sinceVersion: '0.0.1',
};
