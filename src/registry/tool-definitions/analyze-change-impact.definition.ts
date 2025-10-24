/**
 * Enhanced Tool Definition: analyze_change_impact
 *
 * Provides rich metadata for the analyze_change_impact tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const analyzeChangeImpactDefinition: McpToolDefinition = {
	name: 'analyze_change_impact',
	category: 'Impact',

	description:
		'Analyze the potential impact of modifying or deleting a file or symbol before making changes. ' +
		'Shows what files will be directly affected, what will be transitively impacted, identifies ' +
		'critical files, calculates risk scores, and provides actionable recommendations. Use this tool ' +
		'before refactoring or removing code to understand the blast radius of your changes and avoid ' +
		'breaking existing functionality.',

	shortDescription:
		'Analyze impact of changes to files or symbols before making modifications',

	whenToUse: [
		'Before refactoring a function or class to understand what code depends on it',
		'Planning to delete unused code and want to verify it\'s truly safe to remove',
		'Evaluating the risk level of a proposed change before starting work',
		'Understanding the scope of work required for a breaking API change',
		'Identifying which test files need to be updated after making a change',
	],

	relatedTools: [
		'analyze_breaking_changes',
		'find_orphaned_code',
		'impact_analysis',
		'get_dependents',
		'trace_symbol_usage',
	],

	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description:
					'Path to the file you plan to modify or delete (e.g., "src/services/user.service.ts"). ' +
					'Use this to analyze file-level changes. Cannot be combined with symbolId - choose one approach.',
			},
			symbolId: {
				type: 'string',
				description:
					'Unique identifier for a specific symbol you plan to modify or delete. ' +
					'Use this for more precise analysis when changing a specific function, class, or variable. ' +
					'Get symbolId from search_symbols results. Cannot be combined with filePath - choose one approach.',
			},
			includeTransitive: {
				type: 'boolean',
				default: false,
				description:
					'Include transitive (indirect) impact analysis. When true, analyzes not just files that ' +
					'directly depend on the target, but also files that depend on those files (the ripple effect). ' +
					'Essential for understanding the full blast radius. May take longer for widely-used code.',
			},
			includeTests: {
				type: 'boolean',
				default: false,
				description:
					'Include test files in the impact analysis. When true, shows which test files cover the ' +
					'target code and will need updates. Useful for planning testing strategy after changes. ' +
					'When false, focuses on production code impact only.',
			},
			includeRiskLevel: {
				type: 'boolean',
				default: true,
				description:
					'Calculate and include risk assessment: a numerical risk score (0-100) and level ' +
					'(LOW/MEDIUM/HIGH/CRITICAL). Factors in number of affected files, criticality, test coverage, ' +
					'and API exposure. Highly recommended to keep enabled - helps prioritize caution.',
			},
			includeConfidence: {
				type: 'boolean',
				default: false,
				description:
					'Include confidence scores indicating reliability of the impact analysis. ' +
					'Useful when dealing with dynamic code patterns that are harder to analyze statically.',
			},
		},
		required: [],
	},

	examples: [
		{
			title: 'Analyze impact of modifying a file',
			description:
				'Check what will be affected if you modify a service file',
			parameters: {
				filePath: 'src/services/user.service.ts',
				includeTransitive: true,
				includeTests: true,
				includeRiskLevel: true,
			},
			expectedOutcome:
				'Returns: all files directly importing from user.service.ts, files transitively ' +
				'depending on it, related test files, risk score (e.g., HIGH/75), and recommendations ' +
				'like "coordinate with team" or "update 12 related tests". Gives complete picture ' +
				'of the change scope.',
		},
		{
			title: 'Analyze symbol deletion impact',
			description:
				'Determine if it\'s safe to delete a specific function',
			parameters: {
				symbolId: 'abc123def456',
				includeTransitive: false,
				includeTests: false,
				includeRiskLevel: true,
			},
			expectedOutcome:
				'Returns: files directly calling or importing this function, risk level. ' +
				'If no files are affected, risk will be LOW and output confirms safe deletion. ' +
				'If files are affected, shows exactly what breaks and impact level.',
		},
		{
			title: 'Quick risk assessment',
			description:
				'Fast check of risk level without detailed analysis',
			parameters: {
				filePath: 'src/utils/helpers.ts',
				includeRiskLevel: true,
			},
			expectedOutcome:
				'Returns: number of directly affected files and risk level only. ' +
				'Fast response useful for quick go/no-go decisions. No transitive analysis ' +
				'means faster but less complete assessment.',
		},
	],

	commonMistakes: [
		'Providing both filePath and symbolId - choose one; symbolId is more precise for specific symbols',
		'Not using includeTransitive for widely-used utilities - misses the full ripple effect',
		'Skipping includeTests when planning changes - leads to broken tests and missed coverage gaps',
		'Ignoring risk assessment recommendations - they\'re based on real impact metrics',
	],

	performanceNotes: [
		'File-level analysis is faster than symbol-level for files with many symbols',
		'Transitive analysis (includeTransitive: true) requires graph traversal and takes longer',
		'Results are cached for 5 minutes per file/symbol',
		'Analysis of widely-used symbols (>50 dependents) may take 2-3 seconds',
	],

	sinceVersion: '0.0.1',
};
