/**
 * Enhanced Tool Definition: get_module_overview
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getModuleOverviewDefinition: McpToolDefinition = {
	name: 'get_module_overview',
	category: 'Architecture',
	description: 'Analyze a specific module (package, directory, or namespace) to understand its structure, dependencies, exports, and health metrics. Use for focused module analysis and refactoring decisions.',
	shortDescription: 'Analyze a specific module\'s structure and dependencies',
	whenToUse: ['Understanding a specific module before refactoring', 'Analyzing module coupling and cohesion', 'Reviewing module exports and public API', 'Assessing module complexity and quality'],
	relatedTools: ['get_architecture_overview', 'compare_modules', 'get_dependencies', 'analyze_package_usage'],
	inputSchema: {
		type: 'object',
		properties: {
			moduleName: { type: 'string', description: 'Module name (e.g., "services", "core")' },
			modulePath: { type: 'string', description: 'Path to module (e.g., "src/services", "packages/core")' },
			includeFiles: { type: 'boolean', default: false, description: 'Include file-level details' },
			includeExports: { type: 'boolean', default: false, description: 'Include exported symbol details' },
			includeSubmodules: { type: 'boolean', default: false, description: 'Include submodule analysis' },
			includeDependencies: { type: 'boolean', default: false, description: 'Include dependency analysis' },
			includeConfidence: { type: 'boolean', default: false, description: 'Include confidence scores' },
		},
		required: [],
	},
	examples: [
		{ title: 'Basic module overview', description: 'Get structure of a module', parameters: { modulePath: 'src/services' }, expectedOutcome: 'Returns module structure and basic statistics' },
		{ title: 'Complete module analysis', description: 'Comprehensive analysis with all details', parameters: { modulePath: 'src/core', includeFiles: true, includeExports: true, includeDependencies: true }, expectedOutcome: 'Returns full module details with files, exports, dependencies' },
	],
	commonMistakes: ['Using moduleName without modulePath - ambiguous', 'Not specifying what details you need'],
	performanceNotes: ['Basic overview fast (<500ms)', 'Full analysis takes 2-3 seconds'],
	sinceVersion: '0.0.1',
};
