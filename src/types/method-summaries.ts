/**
 * Per-method type summaries for LLM-readable type access.
 *
 * Each summary is a compact TypeScript interface (~30-50 lines) that describes
 * the parameters and result types for a single API method. These are served
 * via the constellation://types/api/{methodName} resource.
 *
 * Authoritative source: query-code-graph.definition.ts apiReference pseudocode shapes.
 */

/**
 * Maps each canonical API method name to its LLM-readable type summary.
 */
export const METHOD_SUMMARIES: Record<string, string> = {
	searchSymbols: `// === searchSymbols ===
// Find symbols (functions, classes, variables) by name or pattern
// Resource: constellation://types/api/searchSymbols

interface SearchSymbolsParams {
  query: string;                        // Name or pattern to search
  filterByKind?: SymbolKindCategory[];  // e.g., ['function', 'class', 'interface', 'variable']
  filterByExported?: boolean;           // Only exported symbols
  limit?: number;                       // Max results (default: 50)
  offset?: number;                      // Pagination offset
  includeUsageCount?: boolean;          // Include usage count per symbol
}

interface SearchSymbolsResult {
  symbols: SymbolInfo[];
  pagination?: PaginationMetadata;
}

// SymbolInfo - key fields:
//   .id         - Unique symbol ID (use in getSymbolDetails, impactAnalysis, etc.)
//   .name       - Symbol name
//   .qualifiedName - Fully qualified name
//   .kind       - function | class | interface | variable | type | enum | ...
//   .filePath   - File containing the symbol
//   .line       - Line number
//   .column     - Column number (optional)
//   .isExported - Whether the symbol is exported
//   .signature  - Function/method signature (if applicable)
//   .usageCount - Number of usages (if includeUsageCount was true)

// PaginationMetadata:
//   .total      - Total matching items
//   .returned   - Items in this response
//   .hasMore    - Whether more results are available
//   .nextOffset - Offset for next page (if hasMore)
//   .currentOffset - Current offset`,

	getSymbolDetails: `// === getSymbolDetails ===
// Get detailed information about a specific symbol
// Resource: constellation://types/api/getSymbolDetails

interface GetSymbolDetailsParams {
  symbolId?: string;                    // Unique symbol ID (preferred, from searchSymbols)
  symbolName?: string;                  // Symbol name (use with filePath)
  filePath?: string;                    // File path (use with symbolName)
  includeReferences?: boolean;          // Include usage references
  includeRelationships?: boolean;       // Include call/inheritance relationships
  includeImpactScore?: boolean;         // Include risk/impact score
}
// Note: Provide either symbolId OR (symbolName + filePath)

interface GetSymbolDetailsResult {
  symbol: SymbolDetail;
  references?: SymbolReference[];
  relationships?: SymbolRelationships;
  impactScore?: ImpactScore;
}

// SymbolDetail - key fields:
//   .id, .name, .qualifiedName, .kind, .filePath, .line
//   .signature  - Function/method signature
//   .modifiers  - e.g., ['async', 'static']
//   .decorators - e.g., ['@Injectable']
//   .isDeprecated - Whether marked as deprecated

// SymbolReference:
//   .filePath, .line, .usageType, .context, .aliasName

// SymbolRelationships:
//   .calls[]      - Functions this symbol calls
//   .calledBy[]   - Functions that call this symbol
//   .inheritsFrom[] - Parent classes/interfaces
//   .inheritedBy[]  - Child classes/interfaces
//   .children[]     - Nested symbols (methods, properties)

// ImpactScore:
//   .directUsage, .transitiveImpact, .riskScore, .riskLevel`,

	getDependencies: `// === getDependencies ===
// Get what a file depends on (imports)
// Resource: constellation://types/api/getDependencies

interface GetDependenciesParams {
  filePath: string;                     // File to analyze
  depth?: number;                       // Traversal depth (default: 1, grows EXPONENTIALLY)
  includePackages?: boolean;            // Include external package dependencies
  includeSymbols?: boolean;             // Include imported symbol names
}

interface GetDependenciesResult {
  file: string;
  directDependencies: FileDependency[];
  transitiveDependencies?: TransitiveDependency[];
  packages?: PackageDependency[];
}

// FileDependency:
//   .filePath        - Path of the dependency
//   .importedSymbols - Specific symbols imported (if includeSymbols)
//   .isDefault       - Whether it's a default import
//   .isNamespace     - Whether it's a namespace import

// TransitiveDependency:
//   .filePath  - Path of the transitive dependency
//   .distance  - How many hops away
//   .path[]    - Chain of files from source to this dependency

// PackageDependency:
//   .name, .version, .type`,

	getDependents: `// === getDependents ===
// Get what depends on a file (reverse imports)
// Resource: constellation://types/api/getDependents

interface GetDependentsParams {
  filePath: string;                     // File to analyze
  depth?: number;                       // Traversal depth (default: 1, grows EXPONENTIALLY)
  includeSymbols?: boolean;             // Include used symbol names
  includeImpactMetrics?: boolean;       // Include detailed metrics
}

interface GetDependentsResult {
  file: string;
  directDependents: FileDependent[];
  transitiveDependents?: TransitiveDependent[];
  detailedMetrics?: DependentMetrics;
}

// FileDependent:
//   .filePath     - Path of the dependent file
//   .usedSymbols  - Specific symbols used (if includeSymbols)

// TransitiveDependent:
//   .filePath  - Path of the transitive dependent
//   .distance  - How many hops away
//   .path[]    - Chain of files from this file to the dependent

// DependentMetrics:
//   .byDepth: { [depth]: count }
//   .criticalPaths[][]  - Paths through heavily-used files
//   .mostImpactedFiles[]`,

	findCircularDependencies: `// === findCircularDependencies ===
// Find circular dependency cycles in the codebase
// Resource: constellation://types/api/findCircularDependencies

interface FindCircularDependenciesParams {
  filePath?: string;                    // Start from specific file (optional)
  maxCycleLength?: number;              // Max cycle length to detect (min: 2, max: 10)
}

interface FindCircularDependenciesResult {
  cycles: DependencyCycle[];
  totalCycles: number;
}

// DependencyCycle:
//   .files[]   - Array of file paths forming the cycle (e.g., ["a.ts", "b.ts", "a.ts"])
//   .length    - Number of files in the cycle`,

	traceSymbolUsage: `// === traceSymbolUsage ===
// Find all usages of a symbol across the codebase
// Resource: constellation://types/api/traceSymbolUsage

interface TraceSymbolUsageParams {
  symbolId?: string;                    // Unique symbol ID (preferred)
  symbolName?: string;                  // Symbol name (use with filePath)
  filePath?: string;                    // File path (use with symbolName)
  filterByUsageType?: string[];         // e.g., ['import', 'call', 'reference']
  includeTransitive?: boolean;          // Include indirect usages
  excludeTests?: boolean;              // Exclude test files
}
// Note: Provide either symbolId OR (symbolName + filePath)

interface TraceSymbolUsageResult {
  symbol: { name: string; kind: string; filePath: string };
  directUsages: SymbolUsage[];
  transitiveUsages?: TransitiveUsage[];
}

// SymbolUsage - key fields:
//   .filePath          - File where symbol is used
//   .usageType         - How it's used (import, call, reference, etc.)
//   .relationshipType  - Relationship type
//   .line, .column     - Location (optional)
//   .enclosingSymbol   - { name, kind } of the containing symbol
//   .context           - Surrounding code context
//   .aliasName         - If imported under an alias
//   .isTest            - Whether in a test file
//   .importanceWeight  - Relative importance

// TransitiveUsage:
//   .filePath, .distance, .chain[]`,

	getCallGraph: `// === getCallGraph ===
// Get function call relationships (who calls whom)
// Resource: constellation://types/api/getCallGraph

interface GetCallGraphParams {
  symbolId?: string;                    // Unique symbol ID (preferred)
  symbolName?: string;                  // Symbol name (use with filePath)
  filePath?: string;                    // File path (use with symbolName)
  direction?: 'callers' | 'callees' | 'both';  // Which direction to traverse (default: 'both')
  depth?: number;                       // Traversal depth
}
// Note: Provide either symbolId OR (symbolName + filePath)

interface GetCallGraphResult {
  root: CallGraphNode;
  callers?: CallGraphNode[];
  callees?: CallGraphNode[];
}

// CallGraphNode:
//   .symbolId  - Symbol ID
//   .name      - Function/method name
//   .filePath  - File containing the symbol
//   .line      - Line number
//   .column    - Column number
//   .isAsync   - Whether the call is async (callees only)
//   .depth     - Distance from root`,

	impactAnalysis: `// === impactAnalysis ===
// Analyze the impact of changing a symbol (blast radius, breaking change risk)
// Resource: constellation://types/api/impactAnalysis

interface ImpactAnalysisParams {
  symbolId?: string;                    // Unique symbol ID (preferred)
  symbolName?: string;                  // Symbol name (use with filePath)
  filePath?: string;                    // File path (use with symbolName)
  depth?: number;                       // Analysis depth
  excludeTests?: boolean;              // Exclude test files from analysis
  analyzeBreakingChanges?: boolean;     // Include breaking change risk assessment
}
// Note: Provide either symbolId OR (symbolName + filePath)

interface ImpactAnalysisResult {
  symbol: SymbolInfo;
  directDependents?: DependentSymbol[];
  transitiveDependents?: DependentSymbol[];
  impactedFiles: ImpactedFile[];
  breakingChangeRisk?: BreakingChangeRisk;
  summary: ImpactSummary;
}

// SymbolInfo: .id, .name, .qualifiedName, .kind, .filePath, .line, .column, .isExported

// DependentSymbol:
//   .id, .name, .qualifiedName, .kind, .filePath, .line
//   .relationshipType  - How it depends on the target
//   .depth             - Distance from the target

// ImpactedFile:
//   .filePath, .symbolCount, .isTest
//   .symbols[]  - [{ id, name, kind, line }]

// BreakingChangeRisk:
//   .riskLevel: 'low' | 'medium' | 'high' | 'critical'
//   .factors[]  - [{ factor, severity, description }]
//   .recommendations[]  - Suggested actions

// ImpactSummary:
//   .directDependentCount, .transitiveDependentCount
//   .impactedFileCount, .testFileCount, .productionFileCount, .maxDepth`,

	findOrphanedCode: `// === findOrphanedCode ===
// Find unused/dead code (exported but never imported)
// Resource: constellation://types/api/findOrphanedCode

interface FindOrphanedCodeParams {
  filePattern?: string;                 // Glob pattern to scope search (e.g., "src/**")
  filterByKind?: string[];              // Filter by symbol kind (e.g., ['function', 'class'])
  exportedOnly?: boolean;               // Only check exported symbols
  excludeTests?: boolean;              // Exclude test files
  includeReasons?: boolean;             // Include reason for orphan status
  includeConfidence?: boolean;          // Include confidence score
}

interface FindOrphanedCodeResult {
  orphanedSymbols: OrphanedSymbol[];
  orphanedFiles: OrphanedFile[];
}

// OrphanedSymbol:
//   .symbolId   - Symbol ID
//   .name       - Symbol name
//   .kind       - Symbol kind
//   .filePath   - File path
//   .isExported - Whether exported
//   .reason     - Why it's considered orphaned (if includeReasons)
//   .confidence - Confidence score (if includeConfidence)

// OrphanedFile:
//   .filePath    - File path
//   .reason      - Why it's considered orphaned
//   .lastUpdated - Last modification date
//   .confidence  - Confidence score (if includeConfidence)`,

	getArchitectureOverview: `// === getArchitectureOverview ===
// Get high-level project structure and metrics
// Resource: constellation://types/api/getArchitectureOverview

interface GetArchitectureOverviewParams {
  includeMetrics?: boolean;             // Include complexity/maintainability metrics
  includeModuleGraph?: boolean;         // Include module dependency graph
  includePackages?: boolean;            // Include external package info
}

interface GetArchitectureOverviewResult {
  metadata: ProjectMetadata;
  structure: ProjectStructure;
  dependencies: DependencyOverview;
  metrics?: QualityMetrics;
  moduleGraph?: ModuleGraph;
}

// ProjectMetadata:
//   .totalFiles, .totalLines
//   .primaryLanguage
//   .languages[]  - [{ language, fileCount, percentage }]
//   .frameworks[] - [{ name, version, confidence }]

// ProjectStructure:
//   .files    - { total, byType: { ".ts": count, ... }, byParadigm }
//   .symbols  - { total, byKind: { "function": count, ... }, exported, public }
//   .modules  - { total, averageSize, largest }

// DependencyOverview:
//   .internal - { totalConnections, averagePerFile, mostConnectedFiles[] }
//   .external - { totalPackages, directDependencies, topPackages[] }

// QualityMetrics:
//   .complexity      - { average, high }
//   .maintainability - { score, issues[] }
//   .testCoverage    - { percentage, testedFiles, totalFiles }

// ModuleGraph:
//   .nodes[] - [{ id, name, fileCount, type }]
//   .edges[] - [{ from, to, weight }]`,

	ping: `// === ping ===
// Verify authentication, configuration, and API connectivity
// Resource: constellation://types/api/ping

// No parameters required
// Call: await api.ping()

interface PingResult {
  pong: true;
}`,

	getCapabilities: `// === getCapabilities ===
// Check project indexing status and available features
// Resource: constellation://types/api/getCapabilities

interface GetCapabilitiesParams {
  // No required parameters - uses current project context
}

interface GetCapabilitiesResult {
  isIndexed: boolean;                   // Whether the project has been indexed
  hasSymbols: boolean;                  // Whether symbols are available
  hasDependencies: boolean;             // Whether dependency data is available
  lastIndexed?: string;                 // ISO timestamp of last index
  symbolCount?: number;                 // Total symbols in the graph
  fileCount?: number;                   // Total files in the graph
  languages?: string[];                 // Detected languages
}`,
};

/**
 * Resolves a method name to its canonical form if it exists.
 * Returns null if the name is not recognized.
 */
export function resolveMethodName(name: string): string | null {
	if (!name) return null;
	if (name in METHOD_SUMMARIES) return name;
	return null;
}
