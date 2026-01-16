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
 * Mirrors constellation-core/apps/client-api/src/mcp/dto/get-dependencies.dto.ts
 */

export interface GetDependenciesParams {
	filePath: string;
	depth?: number;
	includePackages?: boolean;
	includeSymbols?: boolean;
	limit?: number;
	offset?: number;
}

export interface DirectDependency {
	filePath: string;
	importedSymbols?: string[];
	isDefault: boolean;
	isNamespace: boolean;
}

export interface TransitiveDependency {
	filePath: string;
	distance: number;
	path: string[];
}

export interface PackageDependency {
	name: string;
	version?: string;
	type: string;
}

export interface GetDependenciesResult {
	file: string;
	directDependencies: DirectDependency[];
	transitiveDependencies?: TransitiveDependency[];
	packages?: PackageDependency[];
}

/**
 * Get Dependents
 * Mirrors constellation-core/apps/client-api/src/mcp/dto/get-dependents.dto.ts
 */

export interface GetDependentsParams {
	filePath: string;
	depth?: number;
	includeSymbols?: boolean;
	includeImpactMetrics?: boolean;
	limit?: number;
	offset?: number;
}

export interface DirectDependent {
	filePath: string;
	usedSymbols?: string[];
}

export interface TransitiveDependent {
	filePath: string;
	distance: number;
	path: string[];
}

export interface GetDependentsResult {
	file: string;
	directDependents: DirectDependent[];
	transitiveDependents?: TransitiveDependent[];
	detailedMetrics?: {
		byDepth: Record<number, number>;
		criticalPaths: string[][];
		mostImpactedFiles: string[];
	};
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
 * Trace Symbol Usage
 * Mirrors constellation-core/apps/client-api/src/mcp/dto/trace-symbol-usage.dto.ts (Updated: 2025-11-18)
 */

export interface TraceSymbolUsageParams {
	/** Symbol ID if known */
	symbolId?: string;

	/** Symbol name (requires filePath) */
	symbolName?: string;

	/** File path where symbol is defined */
	filePath?: string;

	/** Filter by specific usage types */
	filterByUsageType?: string[];

	/** Filter by relationship type (CALLS, REFERENCES, IMPORTS, etc.) */
	filterByRelationshipType?: string[];

	/** Include indirect (transitive) usage */
	includeTransitive?: boolean;

	/** Include usage context (code snippets) */
	includeContext?: boolean;

	/** Exclude test files from results */
	excludeTests?: boolean;

	/** Exclude generated files from results */
	excludeGenerated?: boolean;

	/** Include importance weighting in results */
	includeImportanceWeight?: boolean;

	/** Maximum results to return */
	limit?: number;

	/** Pagination offset */
	offset?: number;
}

export interface TracedSymbol {
	/** Symbol being traced */
	name: string;

	/** Symbol kind */
	kind: string;

	/** File where symbol is defined */
	filePath: string;
}

export interface DirectUsage {
	/** File path where symbol is used */
	filePath: string;

	/** Type of usage */
	usageType: string; // import, call, type, inherit, reference

	/** Relationship type (CALLS, REFERENCES, IMPORTS, etc.) */
	relationshipType: string;

	/** Line number where usage occurs */
	line?: number;

	/** Column number where usage occurs */
	column?: number;

	/** Enclosing symbol (function/class containing this usage) */
	enclosingSymbol?: {
		name: string;
		kind: string;
	};

	/** Surrounding code context (if includeContext=true) */
	context?: string;

	/** Alias if symbol was renamed on import */
	aliasName?: string;

	/** Whether this is a test file */
	isTest?: boolean;

	/** Whether this is a generated file */
	isGenerated?: boolean;

	/** Importance weight (0.0-1.0, if includeImportanceWeight=true) */
	importanceWeight?: number;
}

export interface TransitiveUsage {
	/** File path */
	filePath: string;

	/** Number of hops from source symbol */
	distance: number;

	/** Chain showing how it's reached */
	chain: string[];
}

export interface TraceSymbolUsageResult {
	/** Symbol being traced */
	symbol: TracedSymbol;

	/** Direct usages of the symbol */
	directUsages: DirectUsage[];

	/** Transitive usages (if includeTransitive=true) */
	transitiveUsages?: TransitiveUsage[];
}

/**
 * Impact Analysis
 * Mirrors constellation-core/apps/client-api/src/mcp/dto/impact-analysis.dto.ts
 */

export interface ImpactAnalysisParams {
	symbolId?: string;
	qualifiedName?: string;
	symbolName?: string;
	filePath?: string;
	includeDirectDependents?: boolean;
	includeTransitiveDependents?: boolean;
	depth?: number;
	excludeTests?: boolean;
	excludeGenerated?: boolean;
	analyzeBreakingChanges?: boolean;
}

export interface ImpactedSymbol extends FileLocation {
	id: string;
	name: string;
	qualifiedName: string;
	kind: string;
	relationshipType: string;
	depth: number;
	isExported?: boolean;
	transitiveImpactCount?: number;
}

export interface ImpactedFile {
	filePath: string;
	symbolCount: number;
	isTest?: boolean;
	isGenerated?: boolean;
	symbols: Array<{
		id: string;
		name: string;
		kind: string;
		line: number;
	}>;
}

export interface BreakingChangeRisk {
	riskLevel: 'low' | 'medium' | 'high' | 'critical';
	factors: Array<{
		factor: string;
		severity: 'low' | 'medium' | 'high';
		description: string;
	}>;
	recommendations: string[];
}

export interface ImpactAnalysisResult {
	symbol: {
		id: string;
		name: string;
		qualifiedName: string;
		kind: string;
		filePath: string;
		line: number;
		column: number;
		isExported?: boolean;
	};
	directDependents?: ImpactedSymbol[];
	transitiveDependents?: ImpactedSymbol[];
	impactedFiles: ImpactedFile[];
	breakingChangeRisk?: BreakingChangeRisk;
	summary: {
		directDependentCount: number;
		transitiveDependentCount: number;
		impactedFileCount: number;
		testFileCount: number;
		productionFileCount: number;
		maxDepth: number;
	};
}

/**
 * Get Call Graph
 * Mirrors constellation-core/apps/client-api/src/mcp/dto/get-call-graph.dto.ts
 */

export interface GetCallGraphParams {
	symbolId?: string;
	symbolName?: string;
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
		line: number;
		column: number;
	};
	callers?: Array<{
		symbolId: string;
		name: string;
		filePath: string;
		line: number;
		column: number;
		depth: number;
	}>;
	callees?: Array<{
		symbolId: string;
		name: string;
		filePath: string;
		line: number;
		column: number;
		isAsync: boolean;
		depth: number;
	}>;
}

/**
 * Find Orphaned Code
 * Mirrors constellation-core/apps/client-api/src/mcp/dto/find-orphaned-code.dto.ts
 */

export interface FindOrphanedCodeParams {
	filePattern?: string;
	filterByKind?: string[];
	exportedOnly?: boolean;
	/** Exclude test files from orphan analysis @default true */
	excludeTests?: boolean;
	includeReasons?: boolean;
	includeConfidence?: boolean;
	limit?: number;
	offset?: number;
}

export interface OrphanedSymbol {
	symbolId: string;
	name: string;
	kind: string;
	filePath: string;
	isExported: boolean;
	reason: string;
	confidence: number;
}

export interface OrphanedFile {
	filePath: string;
	reason: string;
	lastUpdated: string;
	confidence: number;
}

export interface FindOrphanedCodeResult {
	orphanedSymbols: OrphanedSymbol[];
	orphanedFiles: OrphanedFile[];
}

/**
 * Get Architecture Overview
 * Mirrors constellation-core/apps/client-api/src/mcp/dto/get-architecture-overview.dto.ts
 */

export interface GetArchitectureOverviewParams {
	includeMetrics?: boolean;
	includeModuleGraph?: boolean;
	includePackages?: boolean;
}

export interface LanguageInfo {
	language: string;
	fileCount: number;
	percentage: number;
}

export interface FrameworkInfo {
	name: string;
	version?: string;
	confidence: 'high' | 'medium' | 'low';
	evidence: string[];
}

export interface ProjectMetadata {
	languages: LanguageInfo[];
	frameworks: FrameworkInfo[];
	primaryLanguage: string;
	totalFiles: number;
	totalLines?: number;
}

export interface StructureStatistics {
	files: {
		total: number;
		byType: Record<string, number>;
		byParadigm: Record<string, number>;
	};
	symbols: {
		total: number;
		byKind: Record<string, number>;
		exported: number;
		public: number;
	};
	modules: {
		total: number;
		averageSize: number;
		largest: string;
	};
}

export interface DependencyOverview {
	internal: {
		totalConnections: number;
		averagePerFile: number;
		mostConnectedFiles: Array<{
			path: string;
			incomingCount: number;
			outgoingCount: number;
		}>;
	};
	external: {
		totalPackages: number;
		directDependencies: number;
		production?: number;
		development?: number;
		topPackages: Array<{
			name: string;
			usageCount: number;
			type?: 'production' | 'development' | 'peer' | 'optional';
		}>;
	};
}

export interface QualityMetrics {
	complexity: {
		average: number;
		high: number;
	};
	maintainability: {
		score: number;
		issues: string[];
	};
	testCoverage?: {
		percentage: number;
		testedFiles: number;
		totalFiles: number;
	};
}

export interface ModuleGraphNode {
	id: string;
	name: string;
	fileCount: number;
	type: string;
}

export interface ModuleGraphEdge {
	from: string;
	to: string;
	weight: number;
}

export interface ModuleGraph {
	nodes: ModuleGraphNode[];
	edges: ModuleGraphEdge[];
}

export interface GetArchitectureOverviewResult {
	metadata: ProjectMetadata;
	structure: StructureStatistics;
	dependencies: DependencyOverview;
	metrics?: QualityMetrics;
	moduleGraph?: ModuleGraph;
}

/**
 * Ping
 * Mirrors constellation-core/apps/client-api/src/mcp/dto/ping.dto.ts
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PingParams {
	// No parameters - ping validates auth/project access from request context
}

export interface PingResult {
	/** Always true on success - indicates connectivity verified */
	pong: true;
}
