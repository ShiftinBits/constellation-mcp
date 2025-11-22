/**
 * Enhanced Tool Definition: get_architecture_overview
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const getArchitectureOverviewDefinition: McpToolDefinition = {
	name: 'get_architecture_overview',
	category: 'Architecture',

	description:
		'High-level codebase architecture overview. USER ASKS: "How is this organized?", "Show architecture", "Overview of codebase". Fast cached response. START HERE when exploring new codebase. Shows modules, layers, tech stack.',

	shortDescription: 'Get high-level architectural overview of the codebase',

	whenToUse: [
		'**USER ASKS:** "How is this organized?", "Show me architecture", "What\'s the structure?", "Overview of codebase"',
		'First time exploring a new codebase - start here before other tools',
		'Understanding tech stack, frameworks, and languages used',
		'Getting file counts, module structure, and organizational patterns',
		'Assessing code health and complexity at high level',
		'Identifying major dependencies and external packages',
	],

	relatedTools: ['search_symbols', 'get_dependencies', 'find_circular_dependencies'],

	triggerPhrases: [
		"how is this organized",
		"show architecture",
		"overview of codebase",
		"project structure",
		"codebase structure",
		"show me the architecture",
		"what's the structure",
		"architecture overview",
	],

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
		'MISTAKE: Expecting file-level details → DO: This is high-level overview only, use search_symbols for specific code',
		'MISTAKE: Not using this as starting point before deeper analysis → DO: Always start here for new codebases',
		'MISTAKE: Enabling includeModuleGraph initially → DO: Start without it for faster response',
	],

	sinceVersion: '0.0.1',
};
