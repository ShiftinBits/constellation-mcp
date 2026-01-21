/**
 * Constellation API Type Definitions
 *
 * Complete TypeScript interfaces for all Constellation Code Intelligence API methods.
 * These types define the parameters and return values for api.* methods in execute_code.
 *
 * API Methods:
 * - api.searchSymbols() - Find functions, classes, variables by name
 * - api.getSymbolDetails() - Get detailed information about a symbol
 * - api.getDependencies() - What does a file import?
 * - api.getDependents() - What imports a file?
 * - api.findCircularDependencies() - Detect import cycles
 * - api.traceSymbolUsage() - Where is a symbol used?
 * - api.getCallGraph() - Function call relationships
 * - api.impactAnalysis() - Assess change risk
 * - api.findOrphanedCode() - Find unused exports
 * - api.getArchitectureOverview() - High-level project structure
 * - api.ping() - Verify connectivity
 *
 * @packageDocumentation
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Pagination metadata returned by list operations.
 * Used when results exceed the limit parameter.
 */
export interface PaginationMetadata {
	/** Total number of results available */
	total: number;
	/** Number of results in this response */
	returned: number;
	/** Whether more results exist beyond this page */
	hasMore: boolean;
	/** Offset to use for next page (only present if hasMore is true) */
	nextOffset?: number;
	/** Current offset used for this page */
	currentOffset: number;
}

/**
 * Location of a symbol within a source file.
 * Line and column numbers are 1-indexed.
 */
export interface FileLocation {
	/** Absolute or project-relative file path */
	filePath: string;
	/** Line number where symbol starts (1-indexed) */
	line: number;
	/** Column number where symbol starts (1-indexed) */
	column?: number;
	/** Line number where symbol ends */
	endLine?: number;
	/** Column number where symbol ends */
	endColumn?: number;
}

/**
 * Language-specific metadata attached to symbols.
 * Contents vary by language (TypeScript, JavaScript, etc.).
 */
export interface LanguageMetadata {
	[key: string]: unknown;
}

// ============================================================================
// api.searchSymbols()
// ============================================================================

/**
 * Parameters for api.searchSymbols()
 *
 * Search for symbols (functions, classes, variables, etc.) by name.
 * Supports fuzzy matching and filtering by kind, visibility, and export status.
 */
export interface SearchSymbolsParams {
	/** Search query - matches against symbol names (fuzzy matching supported) */
	query: string;
	/** Filter by symbol kind: "function", "class", "interface", "variable", "type", etc. */
	filterByKind?: string[];
	/** Filter by visibility: "public", "private", "protected" */
	filterByVisibility?: string[];
	/** Filter to only exported symbols (true) or non-exported (false) */
	isExported?: boolean;
	/** Glob pattern to filter by file path (e.g., "src/components/**") */
	filePattern?: string;
	/** Maximum number of results to return (default: 50) */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
	/** Include usage count for each symbol */
	includeUsageCount?: boolean;
	/** Include JSDoc/documentation for each symbol */
	includeDocumentation?: boolean;
}

/**
 * Information about a single symbol.
 * Extends FileLocation with symbol-specific metadata.
 */
export interface SymbolInfo extends FileLocation {
	/** Unique identifier for this symbol */
	id: string;
	/** Symbol name (e.g., "UserService", "handleClick") */
	name: string;
	/** Fully qualified name including namespace/module path */
	qualifiedName: string;
	/** Symbol kind: "function", "class", "interface", "variable", "type", "method", "property" */
	kind: string;
	/** Type signature (e.g., "(user: User) => Promise<void>") */
	signature?: string;
	/** JSDoc or documentation string */
	documentation?: string;
	/** Visibility modifier: "public", "private", "protected" */
	visibility?: string;
	/** Whether this symbol is exported from its module */
	isExported: boolean;
	/** Number of places this symbol is used (if includeUsageCount=true) */
	usageCount?: number;
	/** Language-specific metadata */
	languageMetadata?: LanguageMetadata;
}

/**
 * Result from api.searchSymbols()
 */
export interface SearchSymbolsResult {
	/** Array of matching symbols */
	symbols: SymbolInfo[];
	/** Pagination metadata (present if results exceed limit) */
	pagination?: PaginationMetadata;
}

// ============================================================================
// api.getSymbolDetails()
// ============================================================================

/**
 * Parameters for api.getSymbolDetails()
 *
 * Get detailed information about a specific symbol.
 * Provide either symbolId OR (symbolName + filePath).
 */
export interface GetSymbolDetailsParams {
	/** Symbol ID from a previous search result (preferred) */
	symbolId?: string;
	/** Symbol name (requires filePath) */
	symbolName?: string;
	/** File path where symbol is defined (required with symbolName) */
	filePath?: string;
	/** Include all references/usages of this symbol */
	includeReferences?: boolean;
	/** Include relationship data (calls, inheritance, etc.) */
	includeRelationships?: boolean;
	/** Calculate impact score for this symbol */
	includeImpactScore?: boolean;
}

/**
 * Detailed symbol information with additional metadata.
 * Extends SymbolInfo with modifiers, decorators, and deprecation status.
 */
export interface SymbolDetails extends SymbolInfo {
	/** Full type signature */
	signature?: string;
	/** JSDoc or documentation string */
	documentation?: string;
	/** Modifiers like "async", "static", "readonly", "abstract" */
	modifiers?: string[];
	/** Type information (language-specific) */
	typeInfo?: unknown;
	/** Decorator names (e.g., "@Injectable", "@Component") */
	decorators?: string[];
	/** Whether marked as deprecated */
	isDeprecated: boolean;
}

/**
 * A reference to where a symbol is used.
 */
export interface SymbolUsageReference extends FileLocation {
	/** How the symbol is used: "import", "call", "type", "inherit", "reference" */
	usageType: string;
	/** Surrounding code context */
	context?: string;
	/** Alias name if symbol was renamed on import */
	aliasName?: string;
}

/**
 * Relationships between this symbol and other symbols.
 */
export interface SymbolRelationships {
	/** Symbols this one calls */
	calls: string[];
	/** Symbols that call this one */
	calledBy: string[];
	/** Base classes/interfaces this extends/implements */
	inheritsFrom: string[];
	/** Classes/interfaces that extend/implement this */
	inheritedBy: string[];
	/** Child symbols (methods, properties) if this is a class/interface */
	children: string[];
}

/**
 * Impact score indicating how critical a symbol is.
 */
export interface ImpactScore {
	/** Number of direct usages */
	directUsage: number;
	/** Transitive impact (usages of usages) */
	transitiveImpact: number;
	/** Calculated risk score (higher = more impactful) */
	riskScore: number;
	/** Risk level category */
	riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Result from api.getSymbolDetails()
 */
export interface GetSymbolDetailsResult {
	/** Detailed symbol information */
	symbol: SymbolDetails;
	/** All references to this symbol (if includeReferences=true) */
	references?: SymbolUsageReference[];
	/** Symbol relationships (if includeRelationships=true) */
	relationships?: SymbolRelationships;
	/** Impact score (if includeImpactScore=true) */
	impactScore?: ImpactScore;
}

// ============================================================================
// api.getDependencies()
// ============================================================================

/**
 * Parameters for api.getDependencies()
 *
 * Find what a file imports (its dependencies).
 */
export interface GetDependenciesParams {
	/** File path to analyze */
	filePath: string;
	/** Depth of transitive dependencies to include (1 = direct only, 2+ = transitive) */
	depth?: number;
	/** Include external package dependencies (node_modules) */
	includePackages?: boolean;
	/** Include which symbols are imported from each dependency */
	includeSymbols?: boolean;
	/** Maximum results to return */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/**
 * A direct import dependency.
 */
export interface DirectDependency {
	/** Path of the imported file */
	filePath: string;
	/** Names of symbols imported from this file */
	importedSymbols?: string[];
	/** Whether this is a default import */
	isDefault: boolean;
	/** Whether this is a namespace import (import * as X) */
	isNamespace: boolean;
}

/**
 * A transitive (indirect) dependency.
 */
export interface TransitiveDependency {
	/** Path of the dependency */
	filePath: string;
	/** Number of hops from the source file */
	distance: number;
	/** Import chain showing how this is reached */
	path: string[];
}

/**
 * An external package dependency.
 */
export interface PackageDependency {
	/** Package name (e.g., "lodash", "@types/node") */
	name: string;
	/** Version from package.json */
	version?: string;
	/** Dependency type: "production", "development", "peer", "optional" */
	type: string;
}

/**
 * Result from api.getDependencies()
 */
export interface GetDependenciesResult {
	/** File that was analyzed */
	file: string;
	/** Direct imports from this file */
	directDependencies: DirectDependency[];
	/** Transitive dependencies (if depth > 1) */
	transitiveDependencies?: TransitiveDependency[];
	/** External package dependencies (if includePackages=true) */
	packages?: PackageDependency[];
}

// ============================================================================
// api.getDependents()
// ============================================================================

/**
 * Parameters for api.getDependents()
 *
 * Find what imports a file (its dependents/consumers).
 */
export interface GetDependentsParams {
	/** File path to analyze */
	filePath: string;
	/** Depth of transitive dependents to include */
	depth?: number;
	/** Include which symbols are used from this file */
	includeSymbols?: boolean;
	/** Include detailed impact metrics */
	includeImpactMetrics?: boolean;
	/** Maximum results to return */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/**
 * A file that directly imports the target file.
 */
export interface DirectDependent {
	/** Path of the file that imports the target */
	filePath: string;
	/** Symbols used from the target file */
	usedSymbols?: string[];
}

/**
 * A file that transitively depends on the target.
 */
export interface TransitiveDependent {
	/** Path of the dependent file */
	filePath: string;
	/** Number of hops from the target file */
	distance: number;
	/** Import chain showing how this is reached */
	path: string[];
}

/**
 * Result from api.getDependents()
 */
export interface GetDependentsResult {
	/** File that was analyzed */
	file: string;
	/** Files that directly import this file */
	directDependents: DirectDependent[];
	/** Transitive dependents (if depth > 1) */
	transitiveDependents?: TransitiveDependent[];
	/** Detailed impact metrics (if includeImpactMetrics=true) */
	detailedMetrics?: {
		/** Count of dependents at each depth level */
		byDepth: Record<number, number>;
		/** Critical dependency paths that could break */
		criticalPaths: string[][];
		/** Files most affected by changes */
		mostImpactedFiles: string[];
	};
}

// ============================================================================
// api.findCircularDependencies()
// ============================================================================

/**
 * Parameters for api.findCircularDependencies()
 *
 * Detect import cycles in the codebase.
 */
export interface FindCircularDependenciesParams {
	/** Optionally focus on cycles involving this file */
	filePath?: string;
	/** Maximum cycle length to detect */
	maxDepth?: number;
}

/**
 * A circular dependency cycle.
 */
export interface CircularDependency {
	/** Files forming the cycle (A -> B -> C -> A) */
	cycle: string[];
	/** Number of files in the cycle */
	length: number;
}

/**
 * Result from api.findCircularDependencies()
 */
export interface FindCircularDependenciesResult {
	/** Detected circular dependency cycles */
	cycles: CircularDependency[];
	/** Total number of cycles found */
	totalCycles: number;
}

// ============================================================================
// api.traceSymbolUsage()
// ============================================================================

/**
 * Parameters for api.traceSymbolUsage()
 *
 * Find all places where a symbol is used.
 * Provide either symbolId OR (symbolName + filePath).
 */
export interface TraceSymbolUsageParams {
	/** Symbol ID from a previous search result (preferred) */
	symbolId?: string;
	/** Symbol name (requires filePath) */
	symbolName?: string;
	/** File path where symbol is defined */
	filePath?: string;
	/** Filter by usage type: "import", "call", "type", "inherit", "reference" */
	filterByUsageType?: string[];
	/** Filter by relationship: "CALLS", "REFERENCES", "IMPORTS", etc. */
	filterByRelationshipType?: string[];
	/** Include transitive usages (usages of usages) */
	includeTransitive?: boolean;
	/** Include surrounding code context */
	includeContext?: boolean;
	/** Exclude test files from results */
	excludeTests?: boolean;
	/** Exclude generated files from results */
	excludeGenerated?: boolean;
	/** Include importance weighting (0.0-1.0) for each usage */
	includeImportanceWeight?: boolean;
	/** Maximum results to return */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/**
 * The symbol being traced.
 */
export interface TracedSymbol {
	/** Symbol name */
	name: string;
	/** Symbol kind */
	kind: string;
	/** File where symbol is defined */
	filePath: string;
}

/**
 * A direct usage of the traced symbol.
 */
export interface DirectUsage {
	/** File where the symbol is used */
	filePath: string;
	/** Type of usage: "import", "call", "type", "inherit", "reference" */
	usageType: string;
	/** Relationship type: "CALLS", "REFERENCES", "IMPORTS", etc. */
	relationshipType: string;
	/** Line number of usage */
	line?: number;
	/** Column number of usage */
	column?: number;
	/** Function/class containing this usage */
	enclosingSymbol?: {
		name: string;
		kind: string;
	};
	/** Surrounding code context (if includeContext=true) */
	context?: string;
	/** Alias if symbol was renamed on import */
	aliasName?: string;
	/** Whether this usage is in a test file */
	isTest?: boolean;
	/** Whether this usage is in a generated file */
	isGenerated?: boolean;
	/** Importance weight 0.0-1.0 (if includeImportanceWeight=true) */
	importanceWeight?: number;
}

/**
 * A transitive usage of the traced symbol.
 */
export interface TransitiveUsage {
	/** File path of the transitive usage */
	filePath: string;
	/** Number of hops from the source symbol */
	distance: number;
	/** Chain showing how it's reached */
	chain: string[];
}

/**
 * Result from api.traceSymbolUsage()
 */
export interface TraceSymbolUsageResult {
	/** Symbol being traced */
	symbol: TracedSymbol;
	/** Direct usages of the symbol */
	directUsages: DirectUsage[];
	/** Transitive usages (if includeTransitive=true) */
	transitiveUsages?: TransitiveUsage[];
}

// ============================================================================
// api.impactAnalysis()
// ============================================================================

/**
 * Parameters for api.impactAnalysis()
 *
 * Analyze the impact of changing a symbol.
 * Provide symbolId, qualifiedName, OR (symbolName + filePath).
 */
export interface ImpactAnalysisParams {
	/** Symbol ID from a previous search result */
	symbolId?: string;
	/** Fully qualified symbol name */
	qualifiedName?: string;
	/** Symbol name (requires filePath) */
	symbolName?: string;
	/** File path where symbol is defined */
	filePath?: string;
	/** Include direct dependent symbols */
	includeDirectDependents?: boolean;
	/** Include transitive dependent symbols */
	includeTransitiveDependents?: boolean;
	/** Depth of transitive analysis */
	depth?: number;
	/** Exclude test files from analysis */
	excludeTests?: boolean;
	/** Exclude generated files from analysis */
	excludeGenerated?: boolean;
	/** Analyze breaking change risk */
	analyzeBreakingChanges?: boolean;
}

/**
 * A symbol impacted by changes.
 */
export interface ImpactedSymbol extends FileLocation {
	/** Symbol ID */
	id: string;
	/** Symbol name */
	name: string;
	/** Fully qualified name */
	qualifiedName: string;
	/** Symbol kind */
	kind: string;
	/** How this symbol is related: "CALLS", "IMPORTS", "EXTENDS", etc. */
	relationshipType: string;
	/** Depth from the source symbol */
	depth: number;
	/** Whether this symbol is exported */
	isExported?: boolean;
	/** Count of symbols transitively impacted through this one */
	transitiveImpactCount?: number;
}

/**
 * A file impacted by changes.
 */
export interface ImpactedFile {
	/** File path */
	filePath: string;
	/** Number of impacted symbols in this file */
	symbolCount: number;
	/** Whether this is a test file */
	isTest?: boolean;
	/** Whether this is a generated file */
	isGenerated?: boolean;
	/** Impacted symbols in this file */
	symbols: Array<{
		id: string;
		name: string;
		kind: string;
		line: number;
	}>;
}

/**
 * Breaking change risk assessment.
 */
export interface BreakingChangeRisk {
	/** Overall risk level */
	riskLevel: 'low' | 'medium' | 'high' | 'critical';
	/** Risk factors identified */
	factors: Array<{
		factor: string;
		severity: 'low' | 'medium' | 'high';
		description: string;
	}>;
	/** Recommendations for safe refactoring */
	recommendations: string[];
}

/**
 * Result from api.impactAnalysis()
 */
export interface ImpactAnalysisResult {
	/** Symbol being analyzed */
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
	/** Direct dependent symbols (if includeDirectDependents=true) */
	directDependents?: ImpactedSymbol[];
	/** Transitive dependent symbols (if includeTransitiveDependents=true) */
	transitiveDependents?: ImpactedSymbol[];
	/** Files impacted by changes */
	impactedFiles: ImpactedFile[];
	/** Breaking change risk (if analyzeBreakingChanges=true) */
	breakingChangeRisk?: BreakingChangeRisk;
	/** Summary statistics */
	summary: {
		/** Number of direct dependents */
		directDependentCount: number;
		/** Number of transitive dependents */
		transitiveDependentCount: number;
		/** Number of impacted files */
		impactedFileCount: number;
		/** Number of impacted test files */
		testFileCount: number;
		/** Number of impacted production files */
		productionFileCount: number;
		/** Maximum depth of impact */
		maxDepth: number;
	};
}

// ============================================================================
// api.getCallGraph()
// ============================================================================

/**
 * Parameters for api.getCallGraph()
 *
 * Get function call relationships.
 * Provide either symbolId OR (symbolName + filePath).
 */
export interface GetCallGraphParams {
	/** Symbol ID from a previous search result */
	symbolId?: string;
	/** Symbol name (requires filePath) */
	symbolName?: string;
	/** File path where symbol is defined */
	filePath?: string;
	/** Direction: "callers" (what calls this), "callees" (what this calls), "both" */
	direction?: 'callers' | 'callees' | 'both';
	/** Depth of call graph to traverse */
	depth?: number;
	/** Exclude calls to external packages */
	excludeExternal?: boolean;
	/** Include graph visualization data */
	includeGraph?: boolean;
	/** Maximum results to return */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/**
 * Result from api.getCallGraph()
 */
export interface GetCallGraphResult {
	/** Root symbol of the call graph */
	root: {
		symbolId: string;
		name: string;
		filePath: string;
		line: number;
		column: number;
	};
	/** Functions that call this symbol (if direction includes "callers") */
	callers?: Array<{
		symbolId: string;
		name: string;
		filePath: string;
		line: number;
		column: number;
		/** Depth from root */
		depth: number;
	}>;
	/** Functions this symbol calls (if direction includes "callees") */
	callees?: Array<{
		symbolId: string;
		name: string;
		filePath: string;
		line: number;
		column: number;
		/** Whether this is an async call */
		isAsync: boolean;
		/** Depth from root */
		depth: number;
	}>;
}

// ============================================================================
// api.findOrphanedCode()
// ============================================================================

/**
 * Parameters for api.findOrphanedCode()
 *
 * Find exported symbols that are never imported (dead code candidates).
 */
export interface FindOrphanedCodeParams {
	/** Glob pattern to filter files (e.g., "src/**") */
	filePattern?: string;
	/** Filter by symbol kind */
	filterByKind?: string[];
	/** Only check exported symbols */
	exportedOnly?: boolean;
	/** Exclude test files from analysis (default: true) */
	excludeTests?: boolean;
	/** Include reason why symbol is considered orphaned */
	includeReasons?: boolean;
	/** Include confidence score for orphan detection */
	includeConfidence?: boolean;
	/** Maximum results to return */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/**
 * An orphaned (unused) symbol.
 */
export interface OrphanedSymbol {
	/** Symbol ID */
	symbolId: string;
	/** Symbol name */
	name: string;
	/** Symbol kind */
	kind: string;
	/** File where symbol is defined */
	filePath: string;
	/** Whether symbol is exported */
	isExported: boolean;
	/** Why this is considered orphaned */
	reason: string;
	/** Confidence score (0.0-1.0) that this is truly orphaned */
	confidence: number;
}

/**
 * An orphaned (unused) file.
 */
export interface OrphanedFile {
	/** File path */
	filePath: string;
	/** Why this file is considered orphaned */
	reason: string;
	/** Last modification date */
	lastUpdated: string;
	/** Confidence score (0.0-1.0) */
	confidence: number;
}

/**
 * Result from api.findOrphanedCode()
 */
export interface FindOrphanedCodeResult {
	/** Orphaned symbols */
	orphanedSymbols: OrphanedSymbol[];
	/** Orphaned files (no exports used anywhere) */
	orphanedFiles: OrphanedFile[];
}

// ============================================================================
// api.getArchitectureOverview()
// ============================================================================

/**
 * Parameters for api.getArchitectureOverview()
 *
 * Get high-level project structure and statistics.
 */
export interface GetArchitectureOverviewParams {
	/** Include code quality metrics */
	includeMetrics?: boolean;
	/** Include module dependency graph */
	includeModuleGraph?: boolean;
	/** Include external package analysis */
	includePackages?: boolean;
}

/**
 * Information about a programming language in the project.
 */
export interface LanguageInfo {
	/** Language name (e.g., "TypeScript", "JavaScript") */
	language: string;
	/** Number of files in this language */
	fileCount: number;
	/** Percentage of codebase in this language */
	percentage: number;
}

/**
 * Information about a detected framework.
 */
export interface FrameworkInfo {
	/** Framework name (e.g., "React", "NestJS", "Express") */
	name: string;
	/** Version if detected */
	version?: string;
	/** Detection confidence */
	confidence: 'high' | 'medium' | 'low';
	/** Evidence for detection (patterns found) */
	evidence: string[];
}

/**
 * Project metadata including languages and frameworks.
 */
export interface ProjectMetadata {
	/** Languages used in the project */
	languages: LanguageInfo[];
	/** Frameworks detected */
	frameworks: FrameworkInfo[];
	/** Primary language by file count */
	primaryLanguage: string;
	/** Total number of indexed files */
	totalFiles: number;
	/** Total lines of code (if available) */
	totalLines?: number;
}

/**
 * Structural statistics about the codebase.
 */
export interface StructureStatistics {
	/** File statistics */
	files: {
		/** Total file count */
		total: number;
		/** Files by extension (e.g., { ".ts": 150, ".tsx": 50 }) */
		byType: Record<string, number>;
		/** Files by paradigm (e.g., { "component": 30, "service": 20 }) */
		byParadigm: Record<string, number>;
	};
	/** Symbol statistics */
	symbols: {
		/** Total symbol count */
		total: number;
		/** Symbols by kind (e.g., { "function": 200, "class": 50 }) */
		byKind: Record<string, number>;
		/** Number of exported symbols */
		exported: number;
		/** Number of public symbols */
		public: number;
	};
	/** Module statistics */
	modules: {
		/** Number of modules/directories */
		total: number;
		/** Average symbols per module */
		averageSize: number;
		/** Largest module path */
		largest: string;
	};
}

/**
 * Internal and external dependency overview.
 */
export interface DependencyOverview {
	/** Internal dependencies (within the project) */
	internal: {
		/** Total import connections */
		totalConnections: number;
		/** Average imports per file */
		averagePerFile: number;
		/** Most connected files (hubs) */
		mostConnectedFiles: Array<{
			path: string;
			/** Files importing this one */
			incomingCount: number;
			/** Files this one imports */
			outgoingCount: number;
		}>;
	};
	/** External dependencies (npm packages) */
	external: {
		/** Total unique packages used */
		totalPackages: number;
		/** Direct dependencies (in package.json) */
		directDependencies: number;
		/** Production dependency count */
		production?: number;
		/** Development dependency count */
		development?: number;
		/** Most used packages */
		topPackages: Array<{
			name: string;
			/** Number of files using this package */
			usageCount: number;
			type?: 'production' | 'development' | 'peer' | 'optional';
		}>;
	};
}

/**
 * Code quality metrics.
 */
export interface QualityMetrics {
	/** Complexity metrics */
	complexity: {
		/** Average cyclomatic complexity */
		average: number;
		/** Number of high-complexity functions */
		high: number;
	};
	/** Maintainability metrics */
	maintainability: {
		/** Maintainability index score */
		score: number;
		/** Identified issues */
		issues: string[];
	};
	/** Test coverage (if available) */
	testCoverage?: {
		/** Coverage percentage */
		percentage: number;
		/** Number of files with tests */
		testedFiles: number;
		/** Total testable files */
		totalFiles: number;
	};
}

/**
 * A node in the module dependency graph.
 */
export interface ModuleGraphNode {
	/** Unique node identifier */
	id: string;
	/** Module/directory name */
	name: string;
	/** Number of files in this module */
	fileCount: number;
	/** Module type classification */
	type: string;
}

/**
 * An edge in the module dependency graph.
 */
export interface ModuleGraphEdge {
	/** Source module ID */
	from: string;
	/** Target module ID */
	to: string;
	/** Connection strength (number of imports) */
	weight: number;
}

/**
 * Module dependency graph for visualization.
 */
export interface ModuleGraph {
	/** Graph nodes (modules) */
	nodes: ModuleGraphNode[];
	/** Graph edges (dependencies between modules) */
	edges: ModuleGraphEdge[];
}

/**
 * Result from api.getArchitectureOverview()
 */
export interface GetArchitectureOverviewResult {
	/** Project metadata including languages and frameworks */
	metadata: ProjectMetadata;
	/** Structural statistics */
	structure: StructureStatistics;
	/** Dependency overview */
	dependencies: DependencyOverview;
	/** Quality metrics (if includeMetrics=true) */
	metrics?: QualityMetrics;
	/** Module graph (if includeModuleGraph=true) */
	moduleGraph?: ModuleGraph;
}

// ============================================================================
// api.ping()
// ============================================================================

/**
 * Parameters for api.ping()
 *
 * Verify authentication and API connectivity.
 * Takes no parameters.
 */
export interface PingParams {
	// No parameters required
}

/**
 * Result from api.ping()
 */
export interface PingResult {
	/** Always true on success - indicates connectivity verified */
	pong: true;
}

// ============================================================================
// INDEXING TYPES (returned by CLI upload operations)
// ============================================================================

/**
 * A file that failed to index during processing.
 */
export interface FileFailure {
	/** File path */
	file: string;
	/** Error message */
	error: string;
}

/**
 * A file with relationship creation failures.
 */
export interface RelationshipFailure {
	/** File path */
	file: string;
	/** Number of failed relationships */
	failedCount: number;
	/** Number of successfully created relationships */
	createdCount: number;
	/** Whether failures were due to transient errors (retryable) */
	isTransient: boolean;
}

/**
 * Summary of relationship creation results.
 */
export interface RelationshipSummary {
	/** Total relationships created */
	totalCreated: number;
	/** Total relationships that failed */
	totalFailed: number;
	/** Files that had at least one relationship failure */
	filesWithFailures: RelationshipFailure[];
}

/**
 * Response from AST indexing operations.
 */
export interface IndexingResponse {
	/** Number of files successfully processed */
	processed: number;
	/** Number of files that failed */
	failed: number;
	/** Project identifier */
	projectId: string;
	/** Git branch name */
	branchName: string;
	/** Details of files that failed */
	failedFiles?: FileFailure[];
	/** Summary of relationship creation results */
	relationships: RelationshipSummary;
}
