/**
 * Enhanced Tool Definition: get_architecture_overview
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getArchitectureOverviewDefinition: McpToolDefinition = {
	name: 'get_architecture_overview',
	category: 'Architecture',

	description:
		'High-level codebase architecture overview: modules, layers, dependencies, statistics. START HERE when exploring a new codebase. ' +
		'Shows tech stack, frameworks, file counts, complexity. Then drill down with get_module_overview for specific modules.',

	shortDescription: 'Get high-level architectural overview of the codebase',

	whenToUse: [
		'First time exploring a new codebase - start here before other tools',
		'Understanding tech stack, frameworks, and languages used',
		'Getting file counts, module structure, and organizational patterns',
		'Assessing code health and complexity at high level',
		'Identifying major dependencies and external packages',
	],

	relatedTools: ['get_module_overview', 'detect_architecture_violations', 'compare_modules', 'analyze_package_usage'],

	inputSchema: {
		type: 'object',
		properties: {
			includeMetrics: {
				type: 'boolean',
				default: false,
				description:
					'Include quality metrics (complexity, maintainability, test coverage) for the entire codebase. ' +
					'Recommended for initial exploration to understand code health.',
			},
			includeModuleGraph: {
				type: 'boolean',
				default: false,
				description:
					'Include module graph structure (nodes, edges, relationships). ' +
					'Slower and larger response. Use only when you need visual/graph representation.',
			},
			includePackages: {
				type: 'boolean',
				default: true,
				description:
					'Include external package dependency details (npm packages, libraries). ' +
					'Default: true. Shows tech stack and major dependencies. Package data is cached.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description:
					'Include confidence scores for architectural pattern detection. ' +
					'Helps understand how certain the analysis is about detected patterns.',
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
		'Expecting file-level details - this is high-level overview only, use get_module_overview or search_files for details',
		'Not using this as starting point before deeper analysis - always start here for new codebases',
		'Enabling includeModuleGraph initially - start without it for faster response',
	],

	sinceVersion: '0.0.1',
};
