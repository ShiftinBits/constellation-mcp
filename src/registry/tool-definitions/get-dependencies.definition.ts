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
		'Find what a file depends on (forward dependencies). USER ASKS: "What does X import?", "Show dependencies", "What packages does this use?". depth=1 <200ms, depth=2 ~500ms. For reverse use get_dependents.',

	shortDescription:
		'Find what a file imports and depends on (forward dependencies)',

	whenToUse: [
		'❓ **USER ASKS:** "What does X import?", "Show dependencies", "What packages does this use?"',
		'🔍 Understanding what modules or packages a file requires to function',
		'🔍 Identifying tightly-coupled code by analyzing dependency depth',
		'🔍 Preparing to extract a file to a separate package',
		'🔍 Finding circular dependency chains starting from a specific file',
		'🔍 Auditing external package usage across specific files',
	],

	relatedTools: [
		'get_dependents',
		'find_circular_dependencies',
		'analyze_package_usage',
		'get_file_details',
		'impact_analysis',
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
					'How many levels deep to traverse the dependency tree (default: 1, max: 10). ' +
					'⚠️ EXPONENTIAL GROWTH: depth=1 might return 10 deps, depth=2 returns 100, depth=3 returns 1000+. ' +
					'depth=1: Only direct dependencies (files this file imports directly). ' +
					'depth=2: Dependencies of dependencies (2 levels deep). ' +
					'depth=3+: Deeper transitive dependencies (use cautiously). ' +
					'Start with default (1), only increase if you need complete transitive closure.',
			},
			includePackages: {
				type: 'boolean',
				default: false,
				description:
					'Include external package dependencies (from node_modules, pip packages, etc). ' +
					'When true, shows npm packages, Python libraries, and other external dependencies. ' +
					'When false, shows only internal project files. ' +
					'Package info is cached (minimal overhead). Enable when auditing package usage or preparing for dependency updates.',
			},
			includeSymbols: {
				type: 'boolean',
				default: false,
				description:
					'Include symbol-level dependency details: which specific functions, classes, or variables ' +
					'are imported from each file. When false, shows just file-level dependencies (faster). ' +
					'When true, shows what\'s actually being used (more detail, useful for understanding coupling). ' +
					'Increases response size significantly.',
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
		'❌ MISTAKE: Starting with depth=3+ → ✅ DO: Start with depth=1, increase if needed (exponential growth)',
		'❌ MISTAKE: Not enabling includePackages for external deps → ✅ DO: Enable to see npm/pip packages',
		'❌ MISTAKE: Confusing with get_dependents → ✅ DO: Dependencies=what X needs, Dependents=who needs X',
		'❌ MISTAKE: Enabling includeSymbols unnecessarily → ✅ DO: Only enable if you need symbol-level detail',
	],

	sinceVersion: '0.0.1',
};
