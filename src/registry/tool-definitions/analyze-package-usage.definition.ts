/**
 * Enhanced Tool Definition: analyze_package_usage
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const analyzePackageUsageDefinition: McpToolDefinition = {
	name: 'analyze_package_usage',
	category: 'Architecture',
	description: 'Analyze external package/library usage across the codebase. Identifies heavily used packages, unused dependencies, duplicate packages, and optimization opportunities.',
	shortDescription: 'Analyze external package usage and dependencies',
	whenToUse: ['Auditing dependencies before updates', 'Finding unused npm packages to remove', 'Detecting duplicate or conflicting package versions', 'Understanding package usage patterns', 'Optimizing bundle size by reducing dependencies'],
	relatedTools: ['get_dependencies', 'get_architecture_overview', 'find_orphaned_code', 'get_module_overview'],
	inputSchema: {
		type: 'object',
		properties: {
			packageName: { type: 'string', description: 'Optional: Analyze specific package (e.g., "lodash")' },
			filterByCategory: { type: 'array', items: { type: 'string' }, description: 'Filter by category: production, development' },
			minUsageCount: { type: 'string', description: 'Minimum usage count to include (default: 1)' },
			includeFileDetails: { type: 'string', description: 'Include file-level usage details' },
			includeModuleBreakdown: { type: 'string', description: 'Include module breakdown within packages' },
			includeDuplicates: { type: 'string', description: 'Include duplicate package detection' },
			limit: { type: 'string', description: 'Max packages to return (default: 50, max: 100)' },
			offset: { type: 'string', description: 'Offset for pagination' },
		},
		required: ['includeFileDetails', 'includeModuleBreakdown', 'includeDuplicates', 'minUsageCount', 'limit', 'offset'],
	},
	examples: [
		{ title: 'Find heavily used packages', description: 'Identify most-used dependencies', parameters: { minUsageCount: '10', limit: '20', includeFileDetails: 'false', includeModuleBreakdown: 'false', includeDuplicates: 'false', offset: '0' }, expectedOutcome: 'Returns top 20 most-used packages' },
		{ title: 'Audit specific package', description: 'See how lodash is used', parameters: { packageName: 'lodash', includeFileDetails: 'true', includeModuleBreakdown: 'true', includeDuplicates: 'false', minUsageCount: '0', limit: '50', offset: '0' }, expectedOutcome: 'Returns detailed lodash usage across codebase' },
	],
	commonMistakes: ['Not checking for duplicates - common issue with monorepos', 'Not analyzing before removing packages'],
	performanceNotes: ['Package analysis takes 2-3 seconds', 'Results cached for 30 minutes'],
	sinceVersion: '0.0.1',
};
