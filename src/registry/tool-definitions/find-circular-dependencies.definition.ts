/**
 * Enhanced Tool Definition: find_circular_dependencies
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const findCircularDependenciesDefinition: McpToolDefinition = {
	name: 'find_circular_dependencies',
	category: 'Dependency',

	description:
		'Detect circular dependency cycles in the codebase where File A depends on File B, which depends ' +
		'on File C, which depends back on File A. Circular dependencies cause issues with module loading, ' +
		'testing, and maintainability. Use this to identify and break problematic dependency cycles.',

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
				description: 'Optional: Find cycles involving this specific file.',
			},
			minCycleLength: {
				type: 'number',
				minimum: 2,
				maximum: 10,
				default: 2,
				description: 'Minimum cycle length to detect. 2=simple cycles, higher=complex chains.',
			},
			includeDetails: {
				type: 'boolean',
				default: true,
				description: 'Include detailed cycle paths showing the full dependency chain.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description: 'Include confidence scores for cycle detection.',
			},
			limit: {
				type: 'number',
				default: 50,
				maximum: 100,
				description: 'Maximum number of cycles to return.',
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

	performanceNotes: [
		'Full codebase scan may take 2-5 seconds',
		'File-specific queries are much faster',
		'Results cached for 30 minutes',
	],

	sinceVersion: '0.0.1',
};
