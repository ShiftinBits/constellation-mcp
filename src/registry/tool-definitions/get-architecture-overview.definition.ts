/**
 * Enhanced Tool Definition: get_architecture_overview
 */

import { McpToolDefinition} from '../McpToolDefinition.interface.js';

export const getArchitectureOverviewDefinition: McpToolDefinition = {
	name: 'get_architecture_overview',
	category: 'Architecture',

	description:
		'Get high-level overview of codebase architecture including modules, layers, dependencies, and statistics. ' +
		'Provides bird\'s-eye view of system structure, module organization, and architectural patterns. Use this ' +
		'to understand overall codebase organization before diving into specifics.',

	shortDescription: 'Get high-level architectural overview of the codebase',

	whenToUse: [
		'Understanding overall codebase structure and organization',
		'Onboarding to a new codebase',
		'Identifying architectural patterns and conventions',
		'Assessing code health and quality metrics',
		'Planning refactoring strategy',
	],

	relatedTools: ['get_module_overview', 'detect_architecture_violations', 'compare_modules', 'analyze_package_usage'],

	inputSchema: {
		type: 'object',
		properties: {
			includeMetrics: {
				type: 'boolean',
				default: false,
				description: 'Include quality metrics: complexity, maintainability, test coverage.',
			},
			includeModuleGraph: {
				type: 'boolean',
				default: false,
				description: 'Include module graph structure.',
			},
			includePackages: {
				type: 'boolean',
				default: true,
				description: 'Include external package dependency details.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description: 'Include confidence scores.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Basic architecture overview',
			description: 'Get simple overview of codebase structure',
			parameters: {
				includePackages: true,
			},
			expectedOutcome: 'Returns module structure, layer organization, and package dependencies.',
		},
		{
			title: 'Comprehensive architecture analysis',
			description: 'Get detailed overview with metrics and graph',
			parameters: {
				includeMetrics: true,
				includeModuleGraph: true,
				includePackages: true,
			},
			expectedOutcome: 'Returns complete architectural view with quality metrics and module relationships.',
		},
		{
			title: 'Quick structure check',
			description: 'Fast overview of modules without extras',
			parameters: {
				includeMetrics: false,
				includeModuleGraph: false,
				includePackages: false,
			},
			expectedOutcome: 'Returns basic module structure and organization only.',
		},
	],

	commonMistakes: [
		'Expecting file-level details - this is high-level overview only',
		'Not using this as starting point before deeper analysis',
	],

	performanceNotes: [
		'Basic overview is fast (<1 second)',
		'Module graph adds 1-2 seconds',
		'Metrics calculation adds 2-3 seconds',
		'Results cached for 30 minutes',
	],

	sinceVersion: '0.0.1',
};
