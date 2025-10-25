/**
 * Enhanced Tool Definition: analyze_package_usage
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const analyzePackageUsageDefinition: McpToolDefinition = {
	name: 'analyze_package_usage',
	category: 'Architecture',
	description:
		'Analyze external package dependencies and usage. USER ASKS: "What packages do we use?", "Analyze dependencies", "Show package usage". Fast, cached data. Two modes: all packages or specific package deep dive.',
	shortDescription: 'Analyze external package usage and dependencies',
	whenToUse: [
		'❓ **USER ASKS:** "What packages do we use?", "Analyze dependencies", "Show package usage", "External deps", "Find unused packages"',
		'🔍 Dependency audit (finding unused packages)',
		'🔍 Bundle size optimization',
		'🔍 Security review (identifying problematic dependencies)',
		'🔍 Understanding which packages are most critical',
		'🔍 Finding duplicate or conflicting package versions',
	],
	relatedTools: ['get_dependencies', 'get_architecture_overview', 'find_orphaned_code', 'get_module_overview'],
	inputSchema: {
		type: 'object',
		properties: {
			packageName: {
				type: 'string',
				description: 'Analyze specific package (e.g., "lodash"). Omit to analyze ALL packages.',
			},
			filterByCategory: {
				type: 'array',
				items: { type: 'string' },
				description: 'Filter by package category: ["production"], ["development"], or both. Omit for all categories.',
			},
			minUsageCount: {
				type: 'string',
				description: 'Minimum usage count to include package (default: 1). Use 0 to find completely unused packages.',
			},
			includeFileDetails: {
				type: 'string',
				description: 'Include file-level usage details (which files import this package). Set to "true" or "false".',
			},
			includeModuleBreakdown: {
				type: 'string',
				description: 'Include breakdown by module within packages (e.g., lodash/map, lodash/filter). Set to "true" or "false".',
			},
			includeDuplicates: {
				type: 'string',
				description: 'Include duplicate package detection (multiple versions of same package). Set to "true" or "false". Critical for monorepos.',
			},
			limit: {
				type: 'string',
				description: 'Maximum packages to return (default: 50, max: 100). Use pagination for large dependency lists.',
			},
			offset: {
				type: 'string',
				description: 'Offset for pagination (default: 0).',
			},
		},
		required: [],
	},
	examples: [
		{
			title: 'Find unused dependencies',
			description: 'Identify packages with zero or low usage',
			parameters: {
				minUsageCount: '0',
				limit: '50',
				includeFileDetails: 'false',
				includeModuleBreakdown: 'false',
				includeDuplicates: 'false',
				offset: '0',
			},
			expectedOutcome: 'Returns packages sorted by usage count, showing candidates for removal',
		},
		{
			title: 'Audit specific package usage',
			description: 'Deep dive into lodash usage patterns',
			parameters: {
				packageName: 'lodash',
				includeFileDetails: 'true',
				includeModuleBreakdown: 'true',
				includeDuplicates: 'false',
				minUsageCount: '0',
				limit: '50',
				offset: '0',
			},
			expectedOutcome: 'Returns detailed lodash usage: which files use it, which lodash modules are imported',
		},
		{
			title: 'Find duplicate packages',
			description: 'Detect conflicting package versions',
			parameters: {
				includeDuplicates: 'true',
				includeFileDetails: 'false',
				includeModuleBreakdown: 'false',
				minUsageCount: '1',
				limit: '100',
				offset: '0',
			},
			expectedOutcome: 'Returns packages with multiple versions installed (common monorepo issue)',
		},
	],
	commonMistakes: [
		'❌ MISTAKE: Not checking includeDuplicates in monorepos → ✅ DO: Common source of build issues, always check for duplicate versions',
		'❌ MISTAKE: Removing packages without checking minUsageCount=0 first → ✅ DO: Verify package is truly unused before removal',
		'❌ MISTAKE: Not analyzing before dependency updates → ✅ DO: Run this tool before major dependency updates to understand impact',
	],
	sinceVersion: '0.0.1',
};
