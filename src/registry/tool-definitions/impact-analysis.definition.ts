/**
 * Enhanced Tool Definition: impact_analysis
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const impactAnalysisDefinition: McpToolDefinition = {
	name: 'impact_analysis',
	category: 'Impact',

	description:
		'Comprehensive impact analysis combining change impact, breaking changes, and dependencies. Provides ' +
		'holistic view of what a change will affect across the codebase - all in one analysis. Use this for ' +
		'the most complete pre-change assessment.',

	shortDescription: 'Comprehensive impact analysis combining multiple perspectives',

	whenToUse: [
		'Planning major refactoring and need complete impact picture',
		'Making critical changes that require thorough analysis',
		'Generating comprehensive change reports for review',
		'Understanding full ripple effect of modifications',
		'Preparing detailed migration plans',
	],

	relatedTools: ['analyze_change_impact', 'analyze_breaking_changes', 'get_dependencies', 'get_dependents'],

	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description: 'File path to analyze.',
			},
			symbolName: {
				type: 'string',
				description: 'Symbol name for symbol-level analysis.',
			},
			symbolId: {
				type: 'string',
				description: 'Unique symbol identifier.',
			},
			qualifiedName: {
				type: 'string',
				description: 'Fully qualified symbol name.',
			},
			includeDirectDependents: {
				type: 'boolean',
				default: true,
				description: 'Include direct dependents analysis.',
			},
			includeTransitiveDependents: {
				type: 'boolean',
				default: true,
				description: 'Include transitive dependents analysis.',
			},
			depth: {
				type: 'number',
				minimum: 1,
				maximum: 5,
				default: 3,
				description: 'Maximum dependency depth to analyze.',
			},
			excludeTests: {
				type: 'boolean',
				default: true,
				description: 'Exclude test files from analysis.',
			},
			excludeGenerated: {
				type: 'boolean',
				default: true,
				description: 'Exclude generated files from analysis.',
			},
			analyzeBreakingChanges: {
				type: 'boolean',
				default: true,
				description: 'Analyze potential breaking changes.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Comprehensive file analysis',
			description: 'Get complete impact analysis for a file',
			parameters: {
				filePath: 'src/core/engine.ts',
				includeDirectDependents: true,
				includeTransitiveDependents: true,
				analyzeBreakingChanges: true,
				depth: 3,
			},
			expectedOutcome: 'Returns complete analysis: dependents, breaking changes, impact metrics.',
		},
		{
			title: 'Symbol-level comprehensive analysis',
			description: 'Analyze impact of changing a specific function',
			parameters: {
				symbolName: 'processData',
				filePath: 'src/services/data.service.ts',
				depth: 2,
				analyzeBreakingChanges: true,
			},
			expectedOutcome: 'Returns full impact analysis focused on the specific symbol.',
		},
		{
			title: 'Production code impact only',
			description: 'Analyze impact excluding tests and generated code',
			parameters: {
				filePath: 'src/api/routes.ts',
				excludeTests: true,
				excludeGenerated: true,
				depth: 2,
			},
			expectedOutcome: 'Returns impact analysis for production code only.',
		},
	],

	commonMistakes: [
		'Using maximum depth on widely-used code - takes very long',
		'Not excluding tests when you only care about production impact',
	],

	performanceNotes: [
		'Most comprehensive tool - takes 3-10 seconds',
		'Depth significantly impacts performance',
		'Results cached for 15 minutes',
	],

	sinceVersion: '0.0.1',
};
