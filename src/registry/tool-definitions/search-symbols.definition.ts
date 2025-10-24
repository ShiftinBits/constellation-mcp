/**
 * Enhanced Tool Definition: search_symbols
 *
 * Provides rich metadata for the search_symbols tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const searchSymbolsDefinition: McpToolDefinition = {
	name: 'search_symbols',
	category: 'Discovery',

	description:
		'Search for symbols (functions, classes, variables, types) by name or pattern across the codebase. Returns symbol names, locations, signatures. ' +
		'Fast pattern matching with filtering by kind, visibility, export status. ' +
		'TYPICAL WORKFLOW: Search here first → use get_symbol_details for specifics.',

	shortDescription:
		'Find symbols by name or pattern with advanced filtering',

	whenToUse: [
		'You know part of a symbol name (e.g., "User" or "*Service") but not exact location',
		'Finding all symbols of a specific kind (all classes, all functions)',
		'Locating exported vs internal symbols',
		'Exploring available APIs in a module or package',
		'Pattern matching across codebase ("format*", "handle*")',
	],

	relatedTools: [
		'get_symbol_details',
		'contextual_symbol_resolution',
		'trace_symbol_usage',
		'search_files',
	],

	inputSchema: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				minLength: 1,
				maxLength: 200,
				description:
					'Symbol name or pattern to search for. Supports partial matches. ' +
					'Examples: "calculate" (finds calculateTotal, calculatePrice), ' +
					'"UserService" (exact match), "handle*" (pattern match)',
			},
			filterByKind: {
				type: 'array',
				items: {
					type: 'string',
					enum: [
						'function',
						'class',
						'variable',
						'interface',
						'type',
						'enum',
						'method',
						'property',
					],
				},
				description:
					'Filter results by symbol type. Use this to narrow down results to specific kinds. ' +
					'Common values: ["function"] for functions only, ["class", "interface"] for types, ' +
					'["method"] for class methods. Omit to search all symbol types.',
			},
			filterByVisibility: {
				type: 'array',
				items: {
					type: 'string',
					enum: ['public', 'private', 'protected'],
				},
				description:
					'Filter by access level. Use ["public"] to find only public APIs, ' +
					'["private"] for internal implementation details, or ["public", "protected"] ' +
					'for accessible members. Primarily useful for object-oriented languages.',
			},
			isExported: {
				type: 'boolean',
				description:
					'Filter by export status. Set to true to find only exported symbols (public API), ' +
					'false to find only non-exported symbols (internal), or omit to include both. ' +
					'Very useful for API discovery and documentation generation.',
			},
			filePattern: {
				type: 'string',
				description:
					'Limit search to files matching this glob pattern. ' +
					'Examples: "src/utils/**" (utils directory), "**/*.test.ts" (test files), ' +
					'"src/components/**/*.tsx" (React components). Use this to scope your search ' +
					'to specific parts of the codebase.',
			},
			limit: {
				type: 'number',
				minimum: 1,
				maximum: 100,
				default: 50,
				description:
					'Maximum number of results to return. Default is 50, max is 100. ' +
					'Start with a lower limit (10-20) for broad searches, increase if needed. ' +
					'Use pagination (offset) for large result sets.',
			},
			offset: {
				type: 'number',
				minimum: 0,
				default: 0,
				description:
					'Skip this many results for pagination. Combine with limit to page through ' +
					'large result sets. Example: limit=20, offset=0 for page 1, offset=20 for page 2.',
			},
			includeUsageCount: {
				type: 'boolean',
				description:
					'Include the number of places where each symbol is used. Useful for understanding ' +
					'symbol importance and identifying heavily-used APIs. May slightly increase response time.',
			},
			includeDocumentation: {
				type: 'boolean',
				description:
					'Include JSDoc/docstring documentation for each symbol. Very useful for understanding ' +
					'symbol purpose without navigating to the definition. May significantly increase response size.',
			},
			includeConfidence: {
				type: 'boolean',
				description:
					'Include confidence scores indicating match quality. Useful for fuzzy searches ' +
					'to understand result relevance.',
			},
		},
		required: ['query'],
	},

	examples: [
		{
			title: 'Basic symbol search',
			description:
				'Find all symbols containing "User" across the entire codebase',
			parameters: {
				query: 'User',
				limit: 20,
			},
			expectedOutcome:
				'Returns up to 20 symbols (functions, classes, interfaces, etc.) with "User" in the name, ' +
				'showing their type, location (file path and line number), and basic signature',
		},
		{
			title: 'Search for utility functions',
			description:
				'Find all functions in the utils directory with "format" in the name',
			parameters: {
				query: 'format',
				filterByKind: ['function'],
				filePattern: 'src/utils/**',
				includeDocumentation: true,
			},
			expectedOutcome:
				'Returns only functions (not classes or variables) in src/utils/ that match "format", ' +
				'with their documentation included to understand what each formatter does',
		},
		{
			title: 'Find exported API classes',
			description:
				'Locate all exported classes for API documentation generation',
			parameters: {
				query: '',
				filterByKind: ['class'],
				isExported: true,
				includeDocumentation: true,
				includeUsageCount: true,
				limit: 100,
			},
			expectedOutcome:
				'Returns all exported classes in the codebase (up to 100), with documentation and usage counts. ' +
				'Empty query with filters returns all symbols matching the filter criteria. ' +
				'Usage counts help prioritize which classes to document first.',
		},
	],

	commonMistakes: [
		'Using when you already have exact file path and symbol name → use get_symbol_details directly instead',
		'Using for dependency information → use get_dependencies/get_dependents instead',
		'Using empty query without filters - returns all symbols (overwhelming)',
		'Setting limit too high (>50) initially - start with 10-20, increase if needed',
		'Not using filePattern when you know general location - significantly narrows results',
		'Using when you need type/import context → use contextual_symbol_resolution instead',
	],

	sinceVersion: '0.0.1',
};
