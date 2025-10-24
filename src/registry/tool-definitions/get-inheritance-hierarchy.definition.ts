/**
 * Enhanced Tool Definition: get_inheritance_hierarchy
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getInheritanceHierarchyDefinition: McpToolDefinition = {
	name: 'get_inheritance_hierarchy',
	category: 'Refactoring',

	description:
		'Analyze class inheritance hierarchies, interfaces, and type relationships. Find ancestors (parent classes) or descendants (child classes). ' +
		'Use direction parameter to control traversal. Detects deep inheritance chains and design issues. ' +
		'TYPICAL WORKFLOW: Find hierarchy here → Review with get_symbol_details → Refactor if chains are too deep.',

	shortDescription: 'Analyze class inheritance and type hierarchies',

	whenToUse: ['Understanding class inheritance structure', 'Finding all subclasses of a base class', 'Analyzing interface implementations', 'Detecting inheritance design issues', 'Planning OOP refactoring'],
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
	commonMistakes: ['Not specifying direction - defaults may not be what you want', 'Unlimited depth on large hierarchies - can be slow'],
	sinceVersion: '0.0.1',
};
