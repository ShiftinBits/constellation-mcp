/**
 * Enhanced Tool Definition: impact_analysis
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const impactAnalysisDefinition: McpToolDefinition = {
	name: 'impact_analysis',
	category: 'Impact',

	description:
		'Comprehensive impact analysis for changes. USER ASKS: "What will break?", "Is it safe to change this?", "Show blast radius". depth=1 <1s (10-50 files), depth=2-3 1-2s (100-500 files). analyzeBreakingChanges for API changes.',

	shortDescription: 'Comprehensive impact analysis - what breaks if you change something',

	whenToUse: [
		'❓ **USER ASKS:** "What will break?", "How many files use this?", "Is it safe to change?"',
		'🔍 Quick impact check before making a change (depth=1)',
		'🔍 Standard pre-refactoring analysis (depth=2-3, default)',
		'🔍 Comprehensive API change analysis (analyzeBreakingChanges=true)',
		'🔍 Full ripple effect with transitive dependencies (depth=4-5)',
		'🔍 Generating detailed change reports and migration plans',
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
		'❌ MISTAKE: Setting depth=5 immediately → ✅ DO: Start with depth=1, check count, then increase if needed',
		'❌ MISTAKE: Using this when simple get_dependents suffices → ✅ DO: Use simpler tools first, escalate if needed',
		'❌ MISTAKE: Not excluding tests (excludeTests=false) → ✅ DO: Exclude tests for production impact',
		'❌ MISTAKE: Using for "where is X defined?" → ✅ DO: Use search_symbols + get_symbol_details',
		'❌ MISTAKE: Running depth=4-5 on core infrastructure → ✅ DO: Use depth=1-2 first, understand scope',
	],

	sinceVersion: '0.0.1',
};
