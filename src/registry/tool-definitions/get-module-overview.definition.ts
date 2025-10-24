/**
 * Enhanced Tool Definition: get_module_overview
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getModuleOverviewDefinition: McpToolDefinition = {
	name: 'get_module_overview',
	category: 'Architecture',
	description:
		'Analyze specific module: structure, dependencies, exports, health metrics. Use modulePath (recommended, e.g., "src/services/auth") or moduleName. ' +
		'Control detail with include flags: Files, Exports, Submodules, Dependencies. For refactoring decisions.',
	shortDescription: 'Analyze a specific module\'s structure and dependencies',
	whenToUse: [
		'Deep dive into a specific module identified from get_architecture_overview',
		'Understanding module structure before refactoring',
		'Reviewing module public API (exports)',
		'Analyzing module coupling, cohesion, and complexity',
		'Assessing submodule organization',
	],
	relatedTools: ['get_architecture_overview', 'compare_modules', 'get_dependencies', 'analyze_package_usage'],
	inputSchema: {
		type: 'object',
		properties: {
			moduleName: {
				type: 'string',
				description: 'Logical module name (e.g., "services", "core"). May be ambiguous if multiple modules share name. Prefer modulePath for precision.',
			},
			modulePath: {
				type: 'string',
				description: 'Exact directory path to module (e.g., "src/services/auth", "packages/core"). RECOMMENDED over moduleName for precision.',
			},
			includeFiles: {
				type: 'boolean',
				default: false,
				description: 'Include file-level details (all files in module with stats). Increases response size.',
			},
			includeExports: {
				type: 'boolean',
				default: false,
				description: 'Include exported symbol details (public API of module). Useful for understanding module interface.',
			},
			includeSubmodules: {
				type: 'boolean',
				default: false,
				description: 'Include analysis of submodules (nested directories/packages). Useful for understanding module organization.',
			},
			includeDependencies: {
				type: 'boolean',
				default: false,
				description: 'Include dependency analysis (what this module depends on and what depends on it). Important for refactoring.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description: 'Include confidence scores for module classification and pattern detection.',
			},
		},
		required: [],
	},
	examples: [
		{ title: 'Basic module overview', description: 'Get structure of a module', parameters: { modulePath: 'src/services' }, expectedOutcome: 'Returns module structure and basic statistics' },
		{ title: 'Complete module analysis', description: 'Comprehensive analysis with all details', parameters: { modulePath: 'src/core', includeFiles: true, includeExports: true, includeDependencies: true }, expectedOutcome: 'Returns full module details with files, exports, dependencies' },
	],
	commonMistakes: [
		'Using moduleName instead of modulePath - can be ambiguous, use exact path',
		'Enabling all flags when you only need basic structure - start simple',
		'Not using this after get_architecture_overview to drill down into specific modules',
	],
	sinceVersion: '0.0.1',
};
