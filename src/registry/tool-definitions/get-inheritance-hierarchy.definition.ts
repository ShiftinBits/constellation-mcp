/**
 * Enhanced Tool Definition: get_inheritance_hierarchy
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const getInheritanceHierarchyDefinition: McpToolDefinition = {
	name: 'get_inheritance_hierarchy',
	category: 'Refactoring',
	description: 'Analyze class inheritance hierarchies, interfaces, and type relationships. Visualize object-oriented structure and identify design issues like deep inheritance chains or diamond problems.',
	shortDescription: 'Analyze class inheritance and type hierarchies',
	whenToUse: ['Understanding class inheritance structure', 'Finding all subclasses of a base class', 'Analyzing interface implementations', 'Detecting inheritance design issues', 'Planning OOP refactoring'],
	relatedTools: ['get_symbol_details', 'find_similar_patterns', 'contextual_symbol_resolution', 'trace_symbol_usage'],
	inputSchema: {
		type: 'object',
		properties: {
			className: { type: 'string', description: 'Class name to analyze (e.g., "UserService")' },
			symbolId: { type: 'string', description: 'Symbol ID (alternative to className)' },
			filePath: { type: 'string', description: 'File containing class (helps disambiguate)' },
			direction: { type: 'string', enum: ['ancestors', 'descendants', 'both'], description: 'Direction: ancestors (parents), descendants (children), or both' },
			depth: { type: 'number', description: 'Max depth to traverse (default: unlimited, max: 20)' },
			filterByRelationshipType: { type: 'array', items: { type: 'string' }, description: 'Filter by: extends, implements' },
			includeGraph: { type: 'string', description: 'Include graph visualization data' },
		},
		required: ['direction', 'includeGraph'],
	},
	examples: [
		{ title: 'Find all subclasses', description: 'Get all classes extending BaseController', parameters: { className: 'BaseController', direction: 'descendants', includeGraph: 'false' }, expectedOutcome: 'Returns all classes that extend BaseController' },
		{ title: 'Full inheritance tree', description: 'Get complete hierarchy for a class', parameters: { className: 'UserService', direction: 'both', includeGraph: 'true' }, expectedOutcome: 'Returns parents and children with graph visualization' },
	],
	commonMistakes: ['Not specifying direction - defaults may not be what you want', 'Unlimited depth on large hierarchies - can be slow'],
	performanceNotes: ['Hierarchy traversal fast for most cases', 'Deep hierarchies (>10 levels) take longer'],
	sinceVersion: '0.0.1',
};
