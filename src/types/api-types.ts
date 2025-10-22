/**
 * API Type Definitions
 *
 * Mirrors DTOs from constellation-core/apps/client-api/src/mcp/dto/
 * These types ensure type safety when communicating with the API
 */

/**
 * Common Types
 */

export interface PaginationMetadata {
	total: number;
	returned: number;
	hasMore: boolean;
	nextOffset?: number;
	currentOffset: number;
}

export interface FileLocation {
	filePath: string;
	line: number;
	column?: number;
	endLine?: number;
	endColumn?: number;
}

export interface LanguageMetadata {
	[key: string]: any;
}

/**
 * Search Symbols
 */

export interface SearchSymbolsParams {
	query: string;
	filterByKind?: string[];
	filterByVisibility?: string[];
	isExported?: boolean;
	filePattern?: string;
	limit?: number;
	offset?: number;
	includeUsageCount?: boolean;
	includeDocumentation?: boolean;
}

export interface SymbolInfo extends FileLocation {
	id: string;
	name: string;
	qualifiedName: string;
	kind: string;
	signature?: string;
	documentation?: string;
	visibility?: string;
	isExported: boolean;
	usageCount?: number;
	languageMetadata?: LanguageMetadata;
}

export interface SearchSymbolsResult {
	symbols: SymbolInfo[];
	pagination?: PaginationMetadata;
}

/**
 * Search Files
 */

export interface SearchFilesParams {
	query: string;
	language?: string;
	limit?: number;
	offset?: number;
	includeStats?: boolean;
}

export interface FileInfo {
	filePath: string;
	language?: string;
	symbolCount?: number;
	size?: number;
	lastModified?: string;
}

export interface SearchFilesResult {
	files: FileInfo[];
	pagination?: PaginationMetadata;
}

/**
 * Get Symbol Details
 */

export interface GetSymbolDetailsParams {
	symbolId?: string;
	symbolName?: string;
	filePath?: string;
	includeDependencies?: boolean;
	includeDependents?: boolean;
	includeUsages?: boolean;
}

export interface SymbolDetails extends SymbolInfo {
	dependencies?: Array<{ target: string; type: string }>;
	dependents?: Array<{ source: string; type: string }>;
	usages?: FileLocation[];
}

export interface GetSymbolDetailsResult {
	symbol: SymbolDetails;
}

/**
 * Get File Details
 */

export interface GetFileDetailsParams {
	filePath: string;
	includeSymbols?: boolean;
	includeDependencies?: boolean;
	includeDependents?: boolean;
}

export interface FileDetails {
	filePath: string;
	language: string;
	symbols?: SymbolInfo[];
	dependencies?: Array<{ target: string; type: string; line?: number }>;
	dependents?: Array<{ source: string; type: string }>;
	stats?: {
		size: number;
		symbolCount: number;
		lastModified: string;
	};
}

export interface GetFileDetailsResult {
	file: FileDetails;
}

/**
 * Get Dependencies
 */

export interface GetDependenciesParams {
	filePath?: string;
	symbolId?: string;
	depth?: number;
	includeExternal?: boolean;
}

export interface Dependency {
	source: string;
	target: string;
	type: string;
	line?: number;
}

export interface GetDependenciesResult {
	dependencies: Dependency[];
	totalCount: number;
}

/**
 * Get Dependents
 */

export interface GetDependentsParams {
	filePath?: string;
	symbolId?: string;
	depth?: number;
}

export interface Dependent {
	source: string;
	target: string;
	type: string;
	usageCount?: number;
}

export interface GetDependentsResult {
	dependents: Dependent[];
	totalCount: number;
}

/**
 * Find Circular Dependencies
 */

export interface FindCircularDependenciesParams {
	filePath?: string;
	maxDepth?: number;
}

export interface CircularDependency {
	cycle: string[];
	length: number;
}

export interface FindCircularDependenciesResult {
	cycles: CircularDependency[];
	totalCycles: number;
}

/**
 * Additional tool result types would go here...
 * (For brevity, including only the most common ones above)
 *
 * In a full implementation, add types for:
 * - TraceSymbolUsageResult
 * - GetCallGraphResult
 * - GetInheritanceHierarchyResult
 * - AnalyzeChangeImpactResult
 * - AnalyzeBreakingChangesResult
 * - FindOrphanedCodeResult
 * - GetArchitectureOverviewResult
 * - GetModuleOverviewResult
 * - DetectArchitectureViolationsResult
 * - AnalyzePackageUsageResult
 * - CompareModulesResult
 * - FindSimilarPatternsResult
 * - FindEntryPointsResult
 * - ContextualSymbolResolutionResult
 * - ImpactAnalysisResult
 */
