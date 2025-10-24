/**
 * Enhanced Tool Definition: detect_architecture_violations
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const detectArchitectureViolationsDefinition: McpToolDefinition = {
	name: 'detect_architecture_violations',
	category: 'Architecture',
	description: 'Detect violations of architectural patterns, layer boundaries, dependency rules, and design principles. Helps maintain clean architecture by identifying problematic dependencies and anti-patterns.',
	shortDescription: 'Detect architectural violations and anti-patterns',
	whenToUse: ['Auditing codebase for architectural issues', 'Enforcing layered architecture boundaries', 'Identifying anti-patterns and code smells', 'Maintaining clean architecture principles', 'Pre-merge architectural validation'],
	relatedTools: ['get_architecture_overview', 'find_circular_dependencies', 'analyze_package_usage', 'get_module_overview'],
	inputSchema: {
		type: 'object',
		properties: {
			minSeverity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'low', description: 'Minimum severity to report' },
			filterByType: { type: 'array', items: { type: 'string' }, description: 'Filter by violation type' },
			includeContext: { type: 'boolean', default: true, description: 'Include code context for violations' },
			includeSuggestions: { type: 'boolean', default: true, description: 'Include fix suggestions' },
			includeCodeHealth: { type: 'boolean', description: 'Include overall code health metrics' },
			includeConfidence: { type: 'boolean', description: 'Include confidence scores' },
			limit: { type: 'number', default: 100, maximum: 100, description: 'Max violations to return' },
			offset: { type: 'number', default: 0, description: 'Offset for pagination' },
		},
		required: [],
	},
	examples: [
		{ title: 'Find critical violations', description: 'Detect serious architectural issues', parameters: { minSeverity: 'high', includeSuggestions: true }, expectedOutcome: 'Returns high/critical violations with fix suggestions' },
		{ title: 'Comprehensive violation scan', description: 'Full architectural audit', parameters: { minSeverity: 'low', includeContext: true, includeSuggestions: true, includeCodeHealth: true }, expectedOutcome: 'Returns all violations with context and health metrics' },
	],
	commonMistakes: ['Setting minSeverity too high - misses important issues', 'Not reviewing fix suggestions'],
	performanceNotes: ['Full scan takes 5-10 seconds', 'Results cached for 30 minutes'],
	sinceVersion: '0.0.1',
};
