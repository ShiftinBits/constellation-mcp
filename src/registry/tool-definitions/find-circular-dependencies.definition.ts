/**
 * Enhanced Tool Definition: find_circular_dependencies
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const findCircularDependenciesDefinition: McpToolDefinition = {
	name: 'find_circular_dependencies',
	category: 'Dependency',

	description:
		'Detect circular dependency cycles where File A → File B → File C → File A. Circular dependencies cause module loading errors and prevent tree-shaking. ' +
		'Detects cycles of any length (minCycleLength=2 for simple A→B→A, =3 for A→B→C→A). Shows complete dependency paths. ' +
		'TYPICAL WORKFLOW: Find cycles here → Analyze with compare_modules → Refactor to break cycles → Verify with get_dependencies.',

	shortDescription: 'Detect circular dependency cycles',

	whenToUse: [
		'Debugging module loading or import errors',
		'Auditing codebase health and architecture',
		'Identifying tightly-coupled code that needs refactoring',
		'Preparing for tree-shaking or code splitting',
		'Understanding complex interdependencies',
	],

	relatedTools: ['get_dependencies', 'get_dependents', 'detect_architecture_violations', 'compare_modules'],

	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description:
					'Optional: Find cycles involving this specific file (e.g., "src/services/user.service.ts"). ' +
					'Narrows results to only cycles that include this file. ' +
					'Omit to find ALL cycles in the codebase. ' +
					'Example: filePath="src/api/users.ts" finds cycles like users.ts → auth.ts → users.ts.',
			},
			minCycleLength: {
				type: 'number',
				minimum: 2,
				maximum: 10,
				default: 2,
				description:
					'Minimum cycle length to detect (default: 2, range: 2-10). ' +
					'minCycleLength=2: A→B→A (simple 2-file cycles) ' +
					'minCycleLength=3: A→B→C→A (3+ file cycles) ' +
					'minCycleLength=4+: Only complex multi-file chains. ' +
					'RECOMMENDATION: Start with default (2) to catch all cycles, then filter to longer cycles if needed.',
			},
			includeDetails: {
				type: 'boolean',
				default: true,
				description:
					'Include detailed cycle paths showing complete dependency chain (default: true, RECOMMENDED). ' +
					'Shows the full path: A → B → C → A with file paths for each step. ' +
					'Set to false for faster queries if you only need cycle count.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description:
					'Include confidence scores (0-1) for cycle detection (default: false). ' +
					'High confidence (0.9+) = definite import cycle, low confidence (0.5-0.7) = possible dynamic import cycle. ' +
					'Use this to prioritize which cycles to break first.',
			},
			limit: {
				type: 'number',
				default: 50,
				maximum: 100,
				description: 'Maximum number of cycles to return per page (default: 50, max: 100). Use with offset for pagination.',
			},
			offset: {
				type: 'number',
				default: 0,
				description: 'Offset for pagination (default: 0). Example: offset=50 gets cycles 51-100.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Find all circular dependencies',
			description: 'Scan entire codebase for circular dependencies',
			parameters: {
				minCycleLength: 2,
				includeDetails: true,
				limit: 20,
			},
			expectedOutcome: 'Returns up to 20 circular dependency cycles with full paths.',
		},
		{
			title: 'Check if file is part of cycles',
			description: 'See if a specific file has circular dependencies',
			parameters: {
				filePath: 'src/services/user.service.ts',
				includeDetails: true,
			},
			expectedOutcome: 'Returns cycles involving user.service.ts, or empty if none found.',
		},
		{
			title: 'Find complex cycles only',
			description: 'Detect cycles with 3+ files (more complex dependencies)',
			parameters: {
				minCycleLength: 3,
				includeDetails: true,
			},
			expectedOutcome: 'Returns only cycles involving 3 or more files in the chain.',
		},
	],

	commonMistakes: [
		'Setting minCycleLength too high - misses simple 2-file cycles',
		'Not breaking cycles after finding them - they cause real problems',
	],

	sinceVersion: '0.0.1',
};
