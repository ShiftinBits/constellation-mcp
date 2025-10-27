/**
 * Enhanced Tool Definition: get_file_details
 *
 * Provides rich metadata for the get_file_details tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const getFileDetailsDefinition: McpToolDefinition = {
	name: 'get_file_details',
	category: 'Discovery',

	description:
		'Get comprehensive file details: symbols, dependencies, dependents, metrics. USER ASKS: "What\'s in file X?", "Show exports", "What uses this?". Basic <100ms, includeSymbols +100ms, full analysis ~500ms.',

	shortDescription: 'Get comprehensive details about a specific file',

	whenToUse: [
		'❓ **USER ASKS:** "What\'s in this file?", "What does file X export?", "Show me file structure"',
		'🔍 Understanding what a file does and what it exports',
		'🔍 Finding all symbols (functions, classes) defined in a file',
		'🔍 Checking file dependencies and dependents',
		'🔍 Analyzing file complexity and metrics',
		'🔍 Reviewing file structure before making changes',
	],

	relatedTools: ['search_files', 'get_symbol_details', 'get_dependencies', 'get_dependents'],

	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description:
					'Path to the file relative to project root (e.g., "src/components/Button.tsx", "lib/utils/helpers.ts"). REQUIRED. ' +
					'Use forward slashes, not backslashes. Must be exact path.',
			},
			includeSymbols: {
				type: 'boolean',
				default: false,
				description:
					'Include all symbols (functions, classes, variables, types) defined in the file (default: false). ' +
					'Shows what the file exports and defines. Essential for understanding file purpose. ' +
					'Set to true when you need to know "what does this file provide?"',
			},
			includeDependencies: {
				type: 'boolean',
				default: false,
				description:
					'Include files/modules this file depends on - what it imports (default: false). ' +
					'Shows forward dependencies (what this file needs). ' +
					'Useful for understanding file coupling and refactoring impact.',
			},
			includeDependents: {
				type: 'boolean',
				default: false,
				description:
					'Include files that depend on this file - what imports it (default: false). ' +
					'Shows backward dependencies (who needs this file). ' +
					'Critical for impact analysis before modifying the file.',
			},
			includeMetrics: {
				type: 'boolean',
				default: false,
				description:
					'Include code quality metrics: complexity, maintainability, test coverage (default: false). ' +
					'Helps identify files that need refactoring. ' +
					'Pre-computed metrics, minimal overhead.',
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
		'❌ MISTAKE: Enabling all options when you need basic info → ✅ DO: Start minimal, add flags progressively',
		'❌ MISTAKE: Using relative paths incorrectly → ✅ DO: Provide path from project root (e.g., "src/file.ts")',
		'❌ MISTAKE: Using for file search → ✅ DO: Use search_files first to find files',
		'❌ MISTAKE: Not reading actual source code → ✅ DO: Use Read tool to view file contents (Constellation = metadata only)',
	],

	sinceVersion: '0.0.1',
};
