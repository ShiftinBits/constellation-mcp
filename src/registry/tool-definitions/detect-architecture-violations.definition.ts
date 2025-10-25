/**
 * Enhanced Tool Definition: detect_architecture_violations
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const detectArchitectureViolationsDefinition: McpToolDefinition = {
	name: 'detect_architecture_violations',
	category: 'Architecture',
	description:
		'Find layer violations and architectural problems. USER ASKS: "Find violations", "Check architecture", "Are there layer violations?". Moderate speed, analyzes entire codebase. SEVERITY: critical/high/medium/low.',
	shortDescription: 'Detect architectural violations and anti-patterns',
	whenToUse: [
		'❓ **USER ASKS:** "Find violations", "Check architecture", "Are there layer violations?", "Validate architecture"',
		'🔍 Auditing codebase for architectural issues',
		'🔍 Enforcing layered architecture boundaries',
		'🔍 Identifying anti-patterns and code smells',
		'🔍 Maintaining clean architecture principles',
		'🔍 Pre-merge architectural validation',
	],
	relatedTools: ['get_architecture_overview', 'find_circular_dependencies', 'analyze_package_usage', 'get_module_overview'],
	inputSchema: {
		type: 'object',
		properties: {
			minSeverity: {
				type: 'string',
				enum: ['low', 'medium', 'high', 'critical'],
				default: 'low',
				description:
					'Minimum severity level to report (default: low). ' +
					'Use "high" or "critical" to focus on serious issues only. ' +
					'Values: low (minor improvements), medium (design issues), high (major debt), critical (security/stability).',
			},
			filterByType: {
				type: 'array',
				items: { type: 'string' },
				description:
					'Filter by violation type: ' +
					'["layer-boundary"], ["circular-dependency"], ["dependency-rule"], ["cohesion"], ["coupling"]. ' +
					'Combine multiple types as needed. Omit to see all violation types.',
			},
			includeContext: {
				type: 'boolean',
				default: true,
				description: 'Include code context for violations (where violation occurs, surrounding code). Default: true. Highly recommended.',
			},
			includeSuggestions: {
				type: 'boolean',
				default: true,
				description: 'Include fix suggestions for each violation. Default: true. Provides actionable remediation steps.',
			},
			includeCodeHealth: {
				type: 'boolean',
				description: 'Include overall code health metrics and quality scores. Useful for understanding systemic issues.',
			},
			includeConfidence: {
				type: 'boolean',
				description: 'Include confidence scores for each violation detection. Helps assess false positives.',
			},
			limit: {
				type: 'number',
				default: 100,
				maximum: 100,
				description: 'Maximum violations to return (default: 100, max: 100). High default since you want comprehensive view.',
			},
			offset: {
				type: 'number',
				default: 0,
				description: 'Offset for pagination (default: 0). Use with limit for large result sets.',
			},
		},
		required: [],
	},
	examples: [
		{ title: 'Find critical violations', description: 'Detect serious architectural issues', parameters: { minSeverity: 'high', includeSuggestions: true }, expectedOutcome: 'Returns high/critical violations with fix suggestions' },
		{ title: 'Comprehensive violation scan', description: 'Full architectural audit', parameters: { minSeverity: 'low', includeContext: true, includeSuggestions: true, includeCodeHealth: true }, expectedOutcome: 'Returns all violations with context and health metrics' },
	],
	commonMistakes: [
		'❌ MISTAKE: Setting minSeverity too high (e.g., critical only) → ✅ DO: Start with "low" or "medium" to catch important issues',
		'❌ MISTAKE: Not reviewing fix suggestions → ✅ DO: Always check includeSuggestions for actionable remediation steps',
		'❌ MISTAKE: Ignoring medium severity violations → ✅ DO: Medium violations often indicate design debt that will become critical',
	],
	sinceVersion: '0.0.1',
};
