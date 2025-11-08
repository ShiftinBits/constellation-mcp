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
 * Get Symbol Details
 */

export interface GetSymbolDetailsParams {
	symbolId?: string;
	symbolName?: string;
	filePath?: string;
	includeReferences?: boolean;
	includeRelationships?: boolean;
	includeImpactScore?: boolean;
}

export interface SymbolDetails extends SymbolInfo {
	signature?: string;
	documentation?: string;
	modifiers?: string[];
	typeInfo?: any;
	decorators?: string[];
	isDeprecated: boolean;
}

export interface SymbolUsageReference extends FileLocation {
	usageType: string;
	context?: string;
	aliasName?: string;
}

export interface SymbolRelationships {
	calls: string[];
	calledBy: string[];
	inheritsFrom: string[];
	inheritedBy: string[];
	children: string[];
}

export interface ImpactScore {
	directUsage: number;
	transitiveImpact: number;
	riskScore: number;
	riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface GetSymbolDetailsResult {
	symbol: SymbolDetails;
	references?: SymbolUsageReference[];
	relationships?: SymbolRelationships;
	impactScore?: ImpactScore;
}

/**
 * Get Dependencies
 */

export interface GetDependenciesParams {
	filePath?: string;
	symbolId?: string;
	depth?: number;
	includeExternal?: boolean;
	limit?: number;
	offset?: number;
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
	limit?: number;
	offset?: number;
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
 * Analyze Change Impact
 */

export interface AnalyzeChangeImpactParams {
	filePath?: string;
	symbolId?: string;
	includeTransitive?: boolean;
	includeTests?: boolean;
	includeRiskLevel?: boolean;
	includeConfidence?: boolean;
	limit?: number;
	offset?: number;
}

export interface AnalyzeChangeImpactResult {
	target: {
		type: 'file' | 'symbol';
		name: string;
		location: string;
	};
	affectedFiles: Array<{
		filePath: string;
		impactLevel: 'high' | 'medium' | 'low';
		reason: string;
	}>;
	risk?: {
		level: string;
		score: number;
		recommendations: string[];
	};
}

/**
 * Get Call Graph
 */

export interface GetCallGraphParams {
	symbolId?: string;
	functionName?: string;
	filePath?: string;
	direction?: 'callers' | 'callees' | 'both';
	depth?: number;
	excludeExternal?: boolean;
	includeGraph?: boolean;
	limit?: number;
	offset?: number;
}

export interface GetCallGraphResult {
	root: {
		symbolId: string;
		name: string;
		filePath: string;
	};
	callers?: Array<{
		symbolId: string;
		name: string;
		filePath: string;
		depth: number;
	}>;
	callees?: Array<{
		symbolId: string;
		name: string;
		filePath: string;
		isAsync: boolean;
		depth: number;
	}>;
}

/**
 * Additional tool result types would go here...
 * (For brevity, including only the most common ones above)
 *
 * In a full implementation, add types for:
 * - TraceSymbolUsageResult
 * - GetCallGraphResult
 * - AnalyzeChangeImpactResult
 * - AnalyzeBreakingChangesResult
 * - FindOrphanedCodeResult
 * - GetArchitectureOverviewResult
 * - ImpactAnalysisResult
 */
