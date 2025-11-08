/**
 * Tool Definitions Index
 *
 * Central export point for all enhanced tool definitions.
 * Organized by category for easy navigation.
 */

// Discovery Tools
export { getSymbolDetailsDefinition } from './get-symbol-details.definition.js';
export { searchSymbolsDefinition } from './search-symbols.definition.js';

// Dependency Tools
export { findCircularDependenciesDefinition } from './find-circular-dependencies.definition.js';
export { getCallGraphDefinition } from './get-call-graph.definition.js';
export { getDependenciesDefinition } from './get-dependencies.definition.js';
export { getDependentsDefinition } from './get-dependents.definition.js';
export { traceSymbolUsageDefinition } from './trace-symbol-usage.definition.js';

// Impact Analysis Tools
export { findOrphanedCodeDefinition } from './find-orphaned-code.definition.js';
export { impactAnalysisDefinition } from './impact-analysis.definition.js';

// Architecture Tools
export { getArchitectureOverviewDefinition } from './get-architecture-overview.definition.js';


import { McpToolDefinition } from '../McpToolDefinition.interface';

// Import all definitions
import { findCircularDependenciesDefinition } from './find-circular-dependencies.definition.js';
import { findOrphanedCodeDefinition } from './find-orphaned-code.definition.js';
import { getArchitectureOverviewDefinition } from './get-architecture-overview.definition.js';
import { getCallGraphDefinition } from './get-call-graph.definition.js';
import { getDependenciesDefinition } from './get-dependencies.definition.js';
import { getDependentsDefinition } from './get-dependents.definition.js';
import { getSymbolDetailsDefinition } from './get-symbol-details.definition.js';
import { impactAnalysisDefinition } from './impact-analysis.definition.js';
import { searchSymbolsDefinition } from './search-symbols.definition.js';
import { traceSymbolUsageDefinition } from './trace-symbol-usage.definition.js';

/**
 * Array of all tool definitions
 * Use this to register all tools at once
 */
export const allToolDefinitions: McpToolDefinition[] = [
	// Discovery (2 tools)
	searchSymbolsDefinition,
	getSymbolDetailsDefinition,

	// Dependency (5 tools)
	getDependenciesDefinition,
	getDependentsDefinition,
	findCircularDependenciesDefinition,
	traceSymbolUsageDefinition,
	getCallGraphDefinition,

	// Impact (2 tools)
	findOrphanedCodeDefinition,
	impactAnalysisDefinition,

	// Architecture (1 tool)
	getArchitectureOverviewDefinition,
];

/**
 * Get tool definitions by category
 */
export const toolDefinitionsByCategory = {
	Discovery: [
		searchSymbolsDefinition,
		getSymbolDetailsDefinition,
	],
	Dependency: [
		getDependenciesDefinition,
		getDependentsDefinition,
		findCircularDependenciesDefinition,
		traceSymbolUsageDefinition,
		getCallGraphDefinition,
	],
	Impact: [
		findOrphanedCodeDefinition,
		impactAnalysisDefinition,
	],
	Architecture: [
		getArchitectureOverviewDefinition,
	],
};

/**
 * Quick reference count
 */
export const toolDefinitionsCount = {
	total: allToolDefinitions.length,
	byCategory: {
		Discovery: toolDefinitionsByCategory.Discovery.length,
		Dependency: toolDefinitionsByCategory.Dependency.length,
		Impact: toolDefinitionsByCategory.Impact.length,
		Architecture: toolDefinitionsByCategory.Architecture.length,
	},
};
