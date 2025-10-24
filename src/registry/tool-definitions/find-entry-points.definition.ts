/**
 * Enhanced Tool Definition: find_entry_points
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const findEntryPointsDefinition: McpToolDefinition = {
	name: 'find_entry_points',
	category: 'Refactoring',
	description: 'Identify entry points to the application including main functions, API endpoints, CLI commands, event handlers, and test suites. Useful for understanding how code is invoked and tracing execution flow.',
	shortDescription: 'Find application entry points and invocation points',
	whenToUse: ['Understanding application startup flow', 'Mapping API endpoints and routes', 'Finding all CLI command handlers', 'Locating event listeners and handlers', 'Identifying test entry points'],
	relatedTools: ['get_call_graph', 'get_architecture_overview', 'search_files', 'trace_symbol_usage'],
	inputSchema: {
		type: 'object',
		properties: {
			includeCallDepth: { type: 'string', description: 'Include call tree depth from entry points (default: 2, max: 5)' },
			groupByModule: { type: 'string', description: 'Group entry points by module/package' },
			includeConfidence: { type: 'string', description: 'Include confidence scores' },
		},
		required: ['includeCallDepth', 'groupByModule', 'includeConfidence'],
	},
	examples: [
		{ title: 'Find all entry points', description: 'Locate all application entry points', parameters: { includeCallDepth: '1', groupByModule: 'false', includeConfidence: 'false' }, expectedOutcome: 'Returns main functions, API endpoints, CLI commands' },
		{ title: 'Entry points with call trees', description: 'Get entry points with execution flow', parameters: { includeCallDepth: '3', groupByModule: 'true', includeConfidence: 'false' }, expectedOutcome: 'Returns entry points grouped by module with call chains' },
	],
	commonMistakes: ['Not using this before tracing execution', 'High call depth overwhelms results'],
	performanceNotes: ['Entry point detection fast (<1 second)', 'Call depth analysis adds time per level'],
	sinceVersion: '0.0.1',
};
