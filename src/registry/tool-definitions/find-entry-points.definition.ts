/**
 * Enhanced Tool Definition: find_entry_points
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const findEntryPointsDefinition: McpToolDefinition = {
	name: 'find_entry_points',
	category: 'Refactoring',

	description:
		'Find application/module entry points. USER ASKS: "Where does this start?", "Find main entry", "Show entry points". includeCallDepth: 1=immediate, 2-3=deeper chains. Types: main, API endpoints, CLI commands, tests.',

	shortDescription: 'Find application entry points and invocation points',

	whenToUse: [
		'❓ **USER ASKS:** "Where does this start?", "Find main entry", "Show entry points", "What\'s the starting point?", "How does app initialize?"',
		'🔍 Understanding application startup flow and initialization',
		'🔍 Mapping API endpoints and HTTP routes',
		'🔍 Finding all CLI command handlers',
		'🔍 Locating event listeners and handlers',
		'🔍 Identifying test entry points and test suites',
	],
	relatedTools: ['get_call_graph', 'get_architecture_overview', 'search_files', 'trace_symbol_usage'],

	inputSchema: {
		type: 'object',
		properties: {
			includeCallDepth: {
				type: 'string',
				description:
					'Include call tree depth from entry points (default: 2, max: 5). ' +
					'depth=1: Shows functions called directly from entry point. ' +
					'depth=2-3: Shows execution chain 2-3 levels deep. ' +
					'depth=4-5: Deep execution traces (can be large). ' +
					'⚠️ EXPONENTIAL GROWTH: Higher depth = exponentially more results. Start with 2.',
			},
			groupByModule: {
				type: 'string',
				description:
					'Group entry points by module/package (set to "true" or "false"). ' +
					'true: Organizes results by module (e.g., "api/", "cli/", "workers/"). ' +
					'false: Returns flat list of all entry points. ' +
					'Recommended for large applications with many entry points.',
			},
			includeConfidence: {
				type: 'string',
				description:
					'Include confidence scores (set to "true" or "false"). ' +
					'High confidence (0.9+) = definite entry point (main, exports, decorators). ' +
					'Low confidence (0.5-0.7) = possible entry point (event handlers, callbacks).',
			},
			limit: {
				type: 'string',
				description: 'Maximum results to return (default: 15, max: 100). Use with offset for pagination.',
			},
			offset: {
				type: 'string',
				description: 'Offset for pagination (default: 0).',
			},
		},
		required: [],
	},
	examples: [
		{ title: 'Find all entry points', description: 'Locate all application entry points', parameters: { includeCallDepth: '1', groupByModule: 'false', includeConfidence: 'false' }, expectedOutcome: 'Returns main functions, API endpoints, CLI commands' },
		{ title: 'Entry points with call trees', description: 'Get entry points with execution flow', parameters: { includeCallDepth: '3', groupByModule: 'true', includeConfidence: 'false' }, expectedOutcome: 'Returns entry points grouped by module with call chains' },
	],
	commonMistakes: [
		'❌ MISTAKE: Starting with get_call_graph without finding entry points first → ✅ DO: Use find_entry_points first to understand where execution starts',
		'❌ MISTAKE: Setting includeCallDepth too high (>3) → ✅ DO: Start with depth=2, increase only if needed',
		'❌ MISTAKE: Not grouping results for large apps → ✅ DO: Use groupByModule=true for projects with many entry points',
		'❌ MISTAKE: Ignoring confidence scores → ✅ DO: Use includeConfidence=true to distinguish definite vs possible entry points',
	],
	sinceVersion: '0.0.1',
};
