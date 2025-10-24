/**
 * Enhanced Tool Definition: get_file_details
 *
 * Provides rich metadata for the get_file_details tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getFileDetailsDefinition: McpToolDefinition = {
	name: 'get_file_details',
	category: 'Discovery',

	description:
		'Get detailed information about a specific file including all symbols defined in it, ' +
		'its dependencies, dependents, and file statistics. Use this when you need comprehensive ' +
		'information about a single file - what it exports, what it imports, and how complex it is.',

	shortDescription: 'Get comprehensive details about a specific file',

	whenToUse: [
		'Understanding what a file does and what it exports',
		'Finding all symbols (functions, classes) defined in a file',
		'Checking file dependencies and dependents',
		'Analyzing file complexity and metrics',
		'Reviewing file structure before making changes',
	],

	relatedTools: ['search_files', 'get_symbol_details', 'get_dependencies', 'get_dependents'],

	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description: 'Path to the file (e.g., "src/components/Button.tsx"). Required.',
			},
			includeSymbols: {
				type: 'boolean',
				default: false,
				description: 'Include all symbols defined in the file with details.',
			},
			includeDependencies: {
				type: 'boolean',
				default: false,
				description: 'Include files/modules this file depends on.',
			},
			includeDependents: {
				type: 'boolean',
				default: false,
				description: 'Include files that depend on this file.',
			},
			includeMetrics: {
				type: 'boolean',
				default: false,
				description: 'Include code metrics: complexity, maintainability scores.',
			},
		},
		required: ['filePath'],
	},

	examples: [
		{
			title: 'Get file overview with symbols',
			description: 'See what a file exports and defines',
			parameters: {
				filePath: 'src/services/api.service.ts',
				includeSymbols: true,
			},
			expectedOutcome: 'Returns all exported functions, classes, and types defined in the file.',
		},
		{
			title: 'Complete file analysis',
			description: 'Get full details including dependencies and metrics',
			parameters: {
				filePath: 'src/utils/helpers.ts',
				includeSymbols: true,
				includeDependencies: true,
				includeDependents: true,
				includeMetrics: true,
			},
			expectedOutcome: 'Returns comprehensive file information: symbols, imports, usage, complexity.',
		},
		{
			title: 'Quick file check',
			description: 'Basic file information only',
			parameters: {
				filePath: 'src/config/constants.ts',
			},
			expectedOutcome: 'Returns basic file metadata: language, path, size, line count.',
		},
	],

	commonMistakes: [
		'Enabling all options when you only need basic info - increases response time',
		'Using relative paths incorrectly - provide path from project root',
	],

	performanceNotes: [
		'Basic file info is very fast (<50ms)',
		'Symbol extraction adds ~100ms',
		'Dependency analysis adds ~200ms',
		'Results cached for 10 minutes',
	],

	sinceVersion: '0.0.1',
};
