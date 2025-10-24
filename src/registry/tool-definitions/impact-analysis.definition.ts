/**
 * Enhanced Tool Definition: impact_analysis
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const impactAnalysisDefinition: McpToolDefinition = {
	name: 'impact_analysis',
	category: 'Impact',

	description:
		'Comprehensive impact analysis: change impact, breaking changes, dependencies. Consolidated tool (replaces analyze_change_impact and analyze_breaking_changes). ' +
		'Quick (depth=1) to comprehensive (depth=3-5). Use analyzeBreakingChanges=true for API changes.',

	shortDescription: 'Comprehensive impact analysis combining multiple perspectives',

	whenToUse: [
		'Quick impact check before making a change (depth=1)',
		'Standard pre-refactoring analysis (depth=2-3)',
		'Comprehensive API change analysis (analyzeBreakingChanges=true)',
		'Understanding full ripple effect with transitive dependencies (depth=4-5)',
		'Generating detailed change reports and migration plans',
	],

	relatedTools: ['get_dependencies', 'get_dependents', 'trace_symbol_usage', 'find_orphaned_code'],

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
				description:
					'Include direct dependents (files that directly import/use this). ' +
					'Default: true. This is the core analysis - only disable if you truly only care about transitive impact.',
			},
			includeTransitiveDependents: {
				type: 'boolean',
				default: true,
				description:
					'Include transitive dependents (indirect impact through dependency chains). ' +
					'Default: true. Disable for quick checks, enable for comprehensive analysis.',
			},
			depth: {
				type: 'number',
				minimum: 1,
				maximum: 5,
				default: 3,
				description:
					'Maximum dependency depth to analyze (default: 3, max: 5). ' +
					'⚠️ EXPONENTIAL GROWTH: depth=1 might show 10 affected files, depth=2 shows 100, depth=3 shows 1000+. ' +
					'**PARAMETER GUIDANCE FOR COMMON SCENARIOS**: ' +
					'• Quick check → depth=1 ' +
					'• Standard refactoring → depth=2-3 (default) ' +
					'• Major architectural change → depth=4-5 ' +
					'Start with default (3) for balanced detail vs performance.',
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
				description:
					'Analyze potential breaking changes (signature changes, removed exports, etc.). ' +
					'Default: true. Critical for API changes. ' +
					'Provides migration guidance when breaking changes detected.',
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
		'Using depth=5 on widely-used code - can take 10+ seconds and return thousands of results',
		'Not starting with quick check (depth=1) before running comprehensive analysis',
		'Forgetting to exclude tests when analyzing production-only impact',
		'Not using this tool when other simpler tools (get_dependents) would suffice',
	],

	sinceVersion: '0.0.1',
};
