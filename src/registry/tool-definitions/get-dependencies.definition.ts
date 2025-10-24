/**
 * Enhanced Tool Definition: get_dependencies
 *
 * Provides rich metadata for the get_dependencies tool to help AI agents
 * understand when and how to use it effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getDependenciesDefinition: McpToolDefinition = {
	name: 'get_dependencies',
	category: 'Dependency',

	description:
		'Find what a file depends on - its imports, the modules it uses, and the external packages ' +
		'it requires. Shows the forward dependency graph: what does this code need to function? ' +
		'Use this to understand a file\'s requirements, identify coupling, or prepare for refactoring. ' +
		'For the reverse (what depends on this file), use get_dependents instead.',

	shortDescription:
		'Find what a file imports and depends on (forward dependencies)',

	whenToUse: [
		'Understanding what modules or packages a file requires to function',
		'Identifying tightly-coupled code by analyzing dependency depth',
		'Preparing to extract a file to a separate package by reviewing its dependencies',
		'Finding circular dependency chains starting from a specific file',
		'Auditing external package usage across specific files',
	],

	relatedTools: [
		'get_dependents',
		'find_circular_dependencies',
		'analyze_package_usage',
		'get_file_details',
		'analyze_change_impact',
	],

	inputSchema: {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				minLength: 1,
				description:
					'Relative path to the file to analyze (e.g., "src/components/Button.tsx"). ' +
					'This is the starting point for dependency analysis. The tool will find all imports ' +
					'and references this file makes to other code.',
			},
			depth: {
				type: 'number',
				minimum: 0,
				maximum: 10,
				default: 1,
				description:
					'How many levels deep to traverse the dependency tree. ' +
					'depth=1 shows only direct dependencies (files this file imports). ' +
					'depth=2 shows dependencies of dependencies (2 levels). ' +
					'depth=3+ shows deeper transitive dependencies. ' +
					'Start with 1 for initial exploration, increase if you need to see deeper relationships. ' +
					'Higher values (>3) may take longer and return many results.',
			},
			includePackages: {
				type: 'boolean',
				default: false,
				description:
					'Include external package dependencies (from node_modules, pip packages, etc). ' +
					'When true, shows npm packages, Python libraries, and other external dependencies. ' +
					'When false, shows only internal project files. Enable when auditing package usage ' +
					'or preparing for dependency updates.',
			},
			includeSymbols: {
				type: 'boolean',
				default: false,
				description:
					'Include symbol-level dependency details: which specific functions, classes, or variables ' +
					'are imported from each file. When false, shows just file-level dependencies (faster). ' +
					'When true, shows what\'s actually being used (more detail, useful for understanding coupling).',
			},
		},
		required: ['filePath'],
	},

	examples: [
		{
			title: 'Find direct dependencies',
			description:
				'See what files a component directly imports',
			parameters: {
				filePath: 'src/components/UserProfile.tsx',
				depth: 1,
			},
			expectedOutcome:
				'Returns all files that UserProfile.tsx directly imports, showing the import relationships. ' +
				'Fast response focused on immediate dependencies only. Example output: imports from ' +
				'src/hooks/useUser.ts, src/types/User.ts, src/utils/formatters.ts.',
		},
		{
			title: 'Deep dependency analysis with packages',
			description:
				'Understand full dependency tree including external packages',
			parameters: {
				filePath: 'src/services/api.service.ts',
				depth: 3,
				includePackages: true,
				includeSymbols: true,
			},
			expectedOutcome:
				'Returns complete dependency graph 3 levels deep: direct imports, their imports, and ' +
				'their imports, plus all external packages. Shows which specific functions/classes are ' +
				'imported at each level. Useful for understanding full requirements and coupling.',
		},
		{
			title: 'Package audit for a file',
			description:
				'Find all external packages a file depends on',
			parameters: {
				filePath: 'src/utils/data-processing.ts',
				depth: 1,
				includePackages: true,
			},
			expectedOutcome:
				'Returns external npm packages (like lodash, axios, date-fns) that this file uses, ' +
				'along with any internal file imports. Useful for package audits, license compliance, ' +
				'or preparing to reduce dependencies.',
		},
	],

	commonMistakes: [
		'Using high depth (>3) on initial analysis - start with 1 or 2, then increase if needed',
		'Not enabling includePackages when investigating external dependencies - misses npm/pip packages',
		'Confusing get_dependencies (forward: what does X need) with get_dependents (backward: what needs X)',
		'Enabling includeSymbols without needing it - increases response size and time',
	],

	performanceNotes: [
		'depth=1 is fastest, each additional depth level increases computation time',
		'Including packages adds minimal overhead (package info is cached)',
		'Symbol-level details (includeSymbols: true) increases response size significantly',
		'Results are cached for 10 minutes per file',
	],

	sinceVersion: '0.0.1',
};
