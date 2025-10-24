/**
 * Tool Definitions Index
 *
 * Central export point for all enhanced tool definitions.
 * Organized by category for easy navigation.
 */

// Discovery Tools
export { searchSymbolsDefinition } from './search-symbols.definition.js';
export { searchFilesDefinition } from './search-files.definition.js';
export { getSymbolDetailsDefinition } from './get-symbol-details.definition.js';
export { getFileDetailsDefinition } from './get-file-details.definition.js';

// Dependency Tools
export { getDependenciesDefinition } from './get-dependencies.definition.js';
export { getDependentsDefinition } from './get-dependents.definition.js';
export { findCircularDependenciesDefinition } from './find-circular-dependencies.definition.js';
export { traceSymbolUsageDefinition } from './trace-symbol-usage.definition.js';
export { getCallGraphDefinition } from './get-call-graph.definition.js';

// Impact Analysis Tools
export { analyzeChangeImpactDefinition } from './analyze-change-impact.definition.js';
export { findOrphanedCodeDefinition } from './find-orphaned-code.definition.js';
export { analyzeBreakingChangesDefinition } from './analyze-breaking-changes.definition.js';
export { impactAnalysisDefinition } from './impact-analysis.definition.js';

// Architecture Tools
export { getArchitectureOverviewDefinition } from './get-architecture-overview.definition.js';
export { getModuleOverviewDefinition } from './get-module-overview.definition.js';
export { detectArchitectureViolationsDefinition } from './detect-architecture-violations.definition.js';
export { analyzePackageUsageDefinition } from './analyze-package-usage.definition.js';
export { compareModulesDefinition } from './compare-modules.definition.js';

// Refactoring Tools
export { findSimilarPatternsDefinition } from './find-similar-patterns.definition.js';
export { findEntryPointsDefinition } from './find-entry-points.definition.js';
export { getInheritanceHierarchyDefinition } from './get-inheritance-hierarchy.definition.js';
export { contextualSymbolResolutionDefinition } from './contextual-symbol-resolution.definition.js';

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

// Import all definitions
import { searchSymbolsDefinition } from './search-symbols.definition.js';
import { searchFilesDefinition } from './search-files.definition.js';
import { getSymbolDetailsDefinition } from './get-symbol-details.definition.js';
import { getFileDetailsDefinition } from './get-file-details.definition.js';
import { getDependenciesDefinition } from './get-dependencies.definition.js';
import { getDependentsDefinition } from './get-dependents.definition.js';
import { findCircularDependenciesDefinition } from './find-circular-dependencies.definition.js';
import { traceSymbolUsageDefinition } from './trace-symbol-usage.definition.js';
import { getCallGraphDefinition } from './get-call-graph.definition.js';
import { analyzeChangeImpactDefinition } from './analyze-change-impact.definition.js';
import { findOrphanedCodeDefinition } from './find-orphaned-code.definition.js';
import { analyzeBreakingChangesDefinition } from './analyze-breaking-changes.definition.js';
import { impactAnalysisDefinition } from './impact-analysis.definition.js';
import { getArchitectureOverviewDefinition } from './get-architecture-overview.definition.js';
import { getModuleOverviewDefinition } from './get-module-overview.definition.js';
import { detectArchitectureViolationsDefinition } from './detect-architecture-violations.definition.js';
import { analyzePackageUsageDefinition } from './analyze-package-usage.definition.js';
import { compareModulesDefinition } from './compare-modules.definition.js';
import { findSimilarPatternsDefinition } from './find-similar-patterns.definition.js';
import { findEntryPointsDefinition } from './find-entry-points.definition.js';
import { getInheritanceHierarchyDefinition } from './get-inheritance-hierarchy.definition.js';
import { contextualSymbolResolutionDefinition } from './contextual-symbol-resolution.definition.js';

/**
 * Array of all tool definitions
 * Use this to register all tools at once
 */
export const allToolDefinitions: McpToolDefinition[] = [
	// Discovery (4 tools)
	searchSymbolsDefinition,
	searchFilesDefinition,
	getSymbolDetailsDefinition,
	getFileDetailsDefinition,

	// Dependency (5 tools)
	getDependenciesDefinition,
	getDependentsDefinition,
	findCircularDependenciesDefinition,
	traceSymbolUsageDefinition,
	getCallGraphDefinition,

	// Impact (4 tools)
	analyzeChangeImpactDefinition,
	findOrphanedCodeDefinition,
	analyzeBreakingChangesDefinition,
	impactAnalysisDefinition,

	// Architecture (5 tools)
	getArchitectureOverviewDefinition,
	getModuleOverviewDefinition,
	detectArchitectureViolationsDefinition,
	analyzePackageUsageDefinition,
	compareModulesDefinition,

	// Refactoring (4 tools)
	findSimilarPatternsDefinition,
	findEntryPointsDefinition,
	getInheritanceHierarchyDefinition,
	contextualSymbolResolutionDefinition,
];

/**
 * Get tool definitions by category
 */
export const toolDefinitionsByCategory = {
	Discovery: [
		searchSymbolsDefinition,
		searchFilesDefinition,
		getSymbolDetailsDefinition,
		getFileDetailsDefinition,
	],
	Dependency: [
		getDependenciesDefinition,
		getDependentsDefinition,
		findCircularDependenciesDefinition,
		traceSymbolUsageDefinition,
		getCallGraphDefinition,
	],
	Impact: [
		analyzeChangeImpactDefinition,
		findOrphanedCodeDefinition,
		analyzeBreakingChangesDefinition,
		impactAnalysisDefinition,
	],
	Architecture: [
		getArchitectureOverviewDefinition,
		getModuleOverviewDefinition,
		detectArchitectureViolationsDefinition,
		analyzePackageUsageDefinition,
		compareModulesDefinition,
	],
	Refactoring: [
		findSimilarPatternsDefinition,
		findEntryPointsDefinition,
		getInheritanceHierarchyDefinition,
		contextualSymbolResolutionDefinition,
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
		Refactoring: toolDefinitionsByCategory.Refactoring.length,
	},
};
