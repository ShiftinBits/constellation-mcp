/**
 * Enhanced Tool Definition: get_inheritance_hierarchy
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const getInheritanceHierarchyDefinition: McpToolDefinition = {
	name: 'get_inheritance_hierarchy',
	category: 'Refactoring',

	description:
		'Show class inheritance tree (extends/implements). USER ASKS: "Show class hierarchy", "What extends X?", "Inheritance tree". direction: ancestors/descendants/both. Detects deep chains. Refactor if too deep.',

	shortDescription: 'Analyze class inheritance and type hierarchies',

	whenToUse: [
		'❓ **USER ASKS:** "Show class hierarchy", "What extends X?", "Inheritance tree", "Show OOP structure", "What are the subclasses?"',
		'🔍 Understanding class inheritance structure and relationships',
		'🔍 Finding all subclasses of a base class',
		'🔍 Analyzing interface implementations',
		'🔍 Detecting inheritance design issues (deep hierarchies)',
		'🔍 Planning OOP refactoring and simplification',
	],
	relatedTools: ['get_symbol_details', 'find_similar_patterns', 'contextual_symbol_resolution', 'trace_symbol_usage'],

	inputSchema: {
		type: 'object',
		properties: {
			className: {
				type: 'string',
				description:
					'Class name to analyze (e.g., "UserService", "BaseController"). ' +
					'Required if symbolId not provided. If multiple classes share this name, use filePath to disambiguate.',
			},
			symbolId: {
				type: 'string',
				description:
					'Unique symbol identifier from search results (alternative to className). ' +
					'RECOMMENDED for precision when you have the ID from search_symbols or get_symbol_details.',
			},
			filePath: {
				type: 'string',
				description:
					'File path containing the class (e.g., "src/models/User.ts"). ' +
					'Optional but helps resolve ambiguity when multiple classes have the same name.',
			},
			direction: {
				type: 'string',
				enum: ['ancestors', 'descendants', 'both'],
				description:
					'Direction to traverse (REQUIRED). Valid values: ' +
					'ancestors: Find parent classes (what this class extends/implements). ' +
					'descendants: Find child classes (what extends/implements this class). ' +
					'both: Full hierarchy tree (parents and children).',
			},
			depth: {
				type: 'number',
				description:
					'Maximum depth to traverse (default: unlimited, max: 20). ' +
					'depth=1: Immediate parents/children only. ' +
					'depth=2-3: Standard depth for most hierarchies. ' +
					'depth=unlimited: Complete hierarchy (can be large). ' +
					'⚠️ EXPONENTIAL GROWTH: Deep hierarchies can return many classes. Start with 3, increase if needed.',
			},
			filterByRelationshipType: {
				type: 'array',
				items: { type: 'string' },
				description:
					'Filter by relationship type. Valid values: ["extends"], ["implements"], or both. ' +
					'extends: Only class inheritance (class X extends Y). ' +
					'implements: Only interface implementation (class X implements Y). ' +
					'Omit to include both types.',
			},
			includeGraph: {
				type: 'string',
				description:
					'Include graph visualization data (set to "true" or "false"). ' +
					'true: Returns graph structure for visualization tools. ' +
					'false: Returns simple list format.',
			},
			limit: {
				type: 'string',
				description: 'Maximum hierarchy nodes to return per page (default: 20, max: 100).',
			},
			offset: {
				type: 'string',
				description: 'Offset for pagination (default: 0).',
			},
		},
		required: [],
	},
	examples: [
		{ title: 'Find all subclasses', description: 'Get all classes extending BaseController', parameters: { className: 'BaseController', direction: 'descendants', includeGraph: 'false' }, expectedOutcome: 'Returns all classes that extend BaseController' },
		{ title: 'Full inheritance tree', description: 'Get complete hierarchy for a class', parameters: { className: 'UserService', direction: 'both', includeGraph: 'true' }, expectedOutcome: 'Returns parents and children with graph visualization' },
	],
	commonMistakes: [
		'❌ MISTAKE: Not specifying direction parameter → ✅ DO: Always specify direction (ancestors/descendants/both) for correct results',
		'❌ MISTAKE: Using unlimited depth on large hierarchies → ✅ DO: Start with depth=3, increase only if needed',
		'❌ MISTAKE: Not using filePath for common class names → ✅ DO: Add filePath to disambiguate when multiple classes share a name',
		'❌ MISTAKE: Forgetting to filter by relationship type → ✅ DO: Use filterByRelationshipType to show only extends or implements if needed',
	],
	sinceVersion: '0.0.1',
};
