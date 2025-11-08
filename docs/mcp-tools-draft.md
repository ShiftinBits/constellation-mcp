# Constellation MCP Server - Tool Specifications

> **⚠️ DRAFT DOCUMENT - OUTDATED**: This document contains specifications for tools that have been removed. The current MCP server implements only 10 tools. For current tool information, see README.md and the tool-definitions directory.

The following tools give your AI development tools, like Claude Code, the ability to understand your entire codebase at a glance, like an experienced senior developer who knows every corner of the project.

## Tool Categories

I'll organize the tools into 5 categories that map to how developers (and AI assistants) actually think about code:

1. **Discovery Tools** - "What exists in this codebase?"
2. **Relationship Tools** - "How do things connect?"
3. **Impact Analysis Tools** - "What happens if I change this?"
4. **Navigation Tools** - "Show me examples/patterns"
5. **Architecture Tools** - "What's the big picture?"

---

## 1. Discovery Tools

### `search_symbols`

Find symbols across the codebase with powerful filtering.

**Purpose**: Let AI quickly locate functions, classes, types, etc. when the user references them or needs examples.

**Input Parameters**:

```typescript
{
  query: string;                    // Name or pattern to search
  kind?: SymbolKind[];              // Filter by symbol type (function, class, etc.)
  visibility?: string[];            // Filter by access modifier
  isExported?: boolean;             // Only exported symbols
  filePattern?: string;             // Limit to file paths matching pattern
  limit?: number;                   // Default: 20, Max: 100
}
```

**Output**:

```typescript
{
	symbols: Array<{
		id: string;
		name: string;
		qualifiedName: string;
		kind: SymbolKind;
		filePath: string;
		line: number;
		signature?: string;
		documentation?: string;
		visibility?: string;
		isExported: boolean;
		usageCount?: number; // How many places use this
	}>;
	totalCount: number;
}
```

**Use Case**: "Find all authentication functions" or "Show me classes that handle user data"

---

### `search_files`

Discover files by characteristics, not just names.

**Purpose**: Help AI understand what files do and find relevant ones semantically.

**Input Parameters**:

```typescript
{
  pathPattern?: string;             // Glob pattern for path
  language?: string[];              // Filter by language
  paradigm?: string[];              // oop, functional, procedural, mixed
  moduleType?: string[];            // service, controller, model, utility, etc.
  isTest?: boolean;                 // Test files only
  isEntryPoint?: boolean;           // Entry point files
  domain?: string;                  // Primary domain/purpose
  limit?: number;
}
```

**Output**:

```typescript
{
	files: Array<{
		path: string;
		language: string;
		paradigm?: string;
		moduleType?: string;
		isTest: boolean;
		domain?: string;
		symbolCounts: { [kind: string]: number };
		dependencyCount: number;
		dependentCount: number;
		updatedAt: string;
	}>;
	totalCount: number;
}
```

**Use Case**: "Find all service layer files" or "Show me test files for authentication"

---

### `get_file_details`

Get comprehensive information about a specific file.

**Purpose**: Deep dive into a single file's structure and metadata.

**Input Parameters**:

```typescript
{
  filePath: string;
  includeSymbols?: boolean;         // Include all symbols in file
  includeDependencies?: boolean;    // Include dependency info
}
```

**Output**:

```typescript
{
  file: {
    path: string;
    language: string;
    paradigm?: string;
    moduleType?: string;
    domain?: string;
    isTest: boolean;
    testFramework?: string;
    symbolCounts: { [kind: string]: number };
    maxNestingDepth?: number;
    metrics: {
      dependencyCount: number;
      dependentCount: number;
      dependencyDepth: number;
    };
  };
  symbols?: Array<SymbolSummary>;      // If includeSymbols=true
  dependencies?: {
    direct: string[];
    packages: string[];
  };
  dependents?: string[];
}
```

**Use Case**: "Tell me everything about src/auth/auth.service.ts"

---

### `get_symbol_details`

Get detailed information about a specific symbol.

**Purpose**: Deep understanding of a function, class, or other symbol.

**Input Parameters**:

```typescript
{
  symbolId?: string;                // If known
  symbolName?: string;              // Search by name
  filePath?: string;                // Narrow search to file
  includeReferences?: boolean;      // Include all usage locations
  includeRelationships?: boolean;   // Include calls, inheritance, etc.
}
```

**Output**:

```typescript
{
  symbol: {
    id: string;
    name: string;
    qualifiedName: string;
    kind: SymbolKind;
    filePath: string;
    line: number;
    column: number;
    signature?: string;
    documentation?: string;
    visibility?: string;
    modifiers?: string[];
    typeInfo?: object;
    decorators?: string[];
    isExported: boolean;
    isDeprecated: boolean;
  };
  references?: Array<{
    filePath: string;
    line: number;
    usageType: string;              // import, call, type, inherit, reference
    context?: string;
  }>;
  relationships?: {
    calls: string[];                // Symbols this calls
    calledBy: string[];             // Symbols that call this
    inherits: string[];             // Parent classes/interfaces
    inheritedBy: string[];          // Child classes
    children: string[];             // Nested symbols
  };
  impactScore?: {
    directUsage: number;
    transitiveImpact: number;
    riskScore: number;
  };
}
```

**Use Case**: "How is the `login` method implemented and where is it used?"

---

## 2. Relationship Tools

### `get_dependencies`

Understand what a file depends on.

**Purpose**: Answer "What does this file need?" - critical for understanding context.

**Input Parameters**:

```typescript
{
  filePath: string;
  depth?: number;                   // 1=direct, 2+=transitive, 0=all
  includePackages?: boolean;        // Include external packages
  includeSymbols?: boolean;         // Show which symbols are imported
}
```

**Output**:

```typescript
{
  file: string;
  directDependencies: Array<{
    filePath: string;
    importedSymbols?: string[];
    line: number;
    isDefault: boolean;
    isNamespace: boolean;
  }>;
  transitiveDependencies?: Array<{
    filePath: string;
    distance: number;               // Hops away
    path: string[];                 // Dependency chain
  }>;
  packages?: Array<{
    name: string;
    version?: string;
    type: string;                   // production, development, etc.
  }>;
  metrics: {
    totalFiles: number;
    totalPackages: number;
    maxDepth: number;
  };
}
```

**Use Case**: "What files do I need to understand to work on this feature?"

---

### `get_dependents`

Understand what depends on a file.

**Purpose**: Answer "What will I affect if I change this?" - critical for impact analysis.

**Input Parameters**:

```typescript
{
  filePath: string;
  depth?: number;                   // Transitive dependents
  includeSymbols?: boolean;         // Show which symbols are used
}
```

**Output**:

```typescript
{
  file: string;
  directDependents: Array<{
    filePath: string;
    usedSymbols?: string[];
    lines: number[];                // Usage locations
  }>;
  transitiveDependents?: Array<{
    filePath: string;
    distance: number;
    path: string[];                 // Impact chain
  }>;
  metrics: {
    totalFiles: number;
    maxDepth: number;
    riskLevel: 'low' | 'medium' | 'high';  // Based on dependent count
  };
}
```

**Use Case**: "What might break if I refactor this file?"

---

### `find_circular_dependencies`

Detect circular dependency cycles.

**Purpose**: Identify architectural issues that can cause build problems.

**Input Parameters**:

```typescript
{
  filePath?: string;                // Check if specific file is in a cycle
  minCycleLength?: number;          // Filter by cycle size
  maxResults?: number;
}
```

**Output**:

```typescript
{
  cycles: Array<{
    files: string[];                // Files in the cycle
    length: number;                 // Number of files in cycle
    impactScore: number;            // Based on file importance
  }>;
  totalCycles: number;
  fileInvolved?: boolean;           // If filePath was provided
}
```

**Use Case**: "Are there any circular dependencies I should be aware of?"

---

### `trace_symbol_usage`

Follow where and how a symbol is used across the codebase.

**Purpose**: Complete usage analysis for refactoring or understanding.

**Input Parameters**:

```typescript
{
  symbolId?: string;
  symbolName?: string;
  filePath?: string;                // If searching by name
  usageType?: string[];             // Filter by usage type
  includeTransitive?: boolean;      // Include indirect usage
}
```

**Output**:

```typescript
{
  symbol: {
    name: string;
    kind: string;
    filePath: string;
  };
  directUsage: Array<{
    filePath: string;
    line: number;
    usageType: string;              // import, call, type, inherit, reference
    context: string;                // Surrounding code context
    symbolName?: string;            // Alias if renamed
  }>;
  transitiveUsage?: Array<{
    filePath: string;
    distance: number;
    chain: string[];                // How it's reached
  }>;
  summary: {
    totalUsages: number;
    usagesByType: { [type: string]: number };
    filesAffected: number;
    transitiveImpact: number;
  };
}
```

**Use Case**: "If I rename this function, what needs to change?"

---

### `get_call_graph`

Understand the call chain for a function.

**Purpose**: Visualize execution flow and dependencies between functions.

**Input Parameters**:

```typescript
{
  symbolId: string;
  direction: 'callers' | 'callees' | 'both';
  depth?: number;                   // Default: 3
  excludeExternal?: boolean;        // Filter out external calls
}
```

**Output**:

```typescript
{
  root: {
    symbolId: string;
    name: string;
    filePath: string;
  };
  callers?: Array<{
    symbolId: string;
    name: string;
    filePath: string;
    line: number;
    depth: number;
  }>;
  callees?: Array<{
    symbolId: string;
    name: string;
    filePath: string;
    line: number;
    isAsync: boolean;
    depth: number;
  }>;
  graph: {
    nodes: Array<{id: string, name: string, filePath: string}>;
    edges: Array<{from: string, to: string, line: number}>;
  };
}
```

**Use Case**: "What functions does this call, and what calls this?"

---

### `get_inheritance_hierarchy`

Get the class/interface inheritance tree.

**Purpose**: Understand OOP relationships and polymorphism.

**Input Parameters**:

```typescript
{
  symbolId: string;
  direction: 'ancestors' | 'descendants' | 'both';
  depth?: number;
}
```

**Output**:

```typescript
{
  root: {
    symbolId: string;
    name: string;
    kind: string;                   // class, interface, trait, etc.
    filePath: string;
  };
  ancestors?: Array<{
    symbolId: string;
    name: string;
    kind: string;
    filePath: string;
    relationshipType: string;       // extends, implements, mixes
    depth: number;
  }>;
  descendants?: Array<{
    symbolId: string;
    name: string;
    kind: string;
    filePath: string;
    relationshipType: string;
    depth: number;
  }>;
  hierarchy: {
    nodes: Array<{id: string, name: string, kind: string}>;
    edges: Array<{from: string, to: string, type: string}>;
  };
}
```

**Use Case**: "What classes inherit from this base class?"

---

## 3. Impact Analysis Tools

### `find_orphaned_code`

Identify unused exports and dead code.

**Purpose**: Help clean up technical debt and improve code health.

**Input Parameters**:

```typescript
{
  filePattern?: string;
  symbolKind?: SymbolKind[];
  exportedOnly?: boolean;           // Only check exported symbols
}
```

**Output**:

```typescript
{
	orphanedSymbols: Array<{
		symbolId: string;
		name: string;
		kind: string;
		filePath: string;
		line: number;
		isExported: boolean;
		reason: string; // "No usages found", "No external references"
		confidence: number; // 0-1, how sure we are it's unused
	}>;
	orphanedFiles: Array<{
		filePath: string;
		reason: string; // "No dependents", "No exports used"
		lastUpdated: string;
		confidence: number;
	}>;
	summary: {
		totalOrphanedSymbols: number;
		totalOrphanedFiles: number;
		potentialDeletions: number;
	}
}
```

**Use Case**: "What code can I safely delete?"

---

## 4. Navigation Tools

### `find_similar_patterns`

Find code that follows similar patterns.

**Purpose**: Help AI find existing examples when implementing new features.

**Input Parameters**:

```typescript
{
  referenceFile?: string;           // Find files similar to this
  referenceSymbol?: string;         // Find symbols similar to this
  symbolKind?: SymbolKind;          // Narrow by kind
  paradigm?: string;                // Match paradigm
  moduleType?: string;              // Match module type
  limit?: number;
}
```

**Output**:

```typescript
{
  reference: {
    type: 'file' | 'symbol';
    path: string;
    name?: string;
  };
  similarItems: Array<{
    type: 'file' | 'symbol';
    path: string;
    name?: string;
    similarityScore: number;        // 0-1
    similarityReasons: string[];    // Why it's similar
    contextInfo: object;
  }>;
  summary: {
    totalFound: number;
    averageSimilarity: number;
  };
}
```

**Use Case**: "Show me how other services handle authentication"

---

### `get_module_overview`

Get a high-level view of a module's structure.

**Purpose**: Understand a module's purpose and organization at a glance.

**Input Parameters**:

```typescript
{
  moduleName?: string;
  modulePath?: string;
  includeFiles?: boolean;
  includeExports?: boolean;
  includeSubmodules?: boolean;
}
```

**Output**:

```typescript
{
  module: {
    name: string;
    type: string;
    rootPath: string;
    language: string;
    framework?: string;
    description?: string;
  };
  structure: {
    fileCount: number;
    submoduleCount: number;
    exportCount: number;
  };
  files?: Array<{
    path: string;
    moduleType: string;
    symbolCount: number;
  }>;
  exports?: Array<{
    symbolName: string;
    symbolKind: string;
    filePath: string;
  }>;
  submodules?: Array<{
    name: string;
    type: string;
    fileCount: number;
  }>;
  dependencies: {
    internal: string[];             // Other modules
    external: string[];             // Packages
  };
}
```

**Use Case**: "Give me an overview of the authentication module"

---

### `get_test_coverage_map`

Map source files to their test files.

**Purpose**: Help AI understand testing structure and find relevant tests.

**Input Parameters**:

```typescript
{
  filePath?: string;                // Find tests for this file
  modulePattern?: string;           // Find tests for module
  includeOrphaned?: boolean;        // Include tests with no source
}
```

**Output**:

```typescript
{
  coverage: Array<{
    sourceFile: string;
    testFiles: Array<{
      path: string;
      framework: string;
      testCount?: number;           // If extractable from symbols
    }>;
    hasCoverage: boolean;
  }>;
  orphanedTests?: Array<{
    testFile: string;
    reason: string;
  }>;
  summary: {
    totalSourceFiles: number;
    testedFiles: number;
    untested Files: number;
    coveragePercentage: number;
  };
}
```

**Use Case**: "Where are the tests for this service?"

---

### `find_entry_points`

Identify application entry points and their call trees.

**Purpose**: Understand how the application starts and what it initializes.

**Input Parameters**:

```typescript
{
  includeCallDepth?: number;        // How deep to trace calls
  groupByModule?: boolean;
}
```

**Output**:

```typescript
{
  entryPoints: Array<{
    filePath: string;
    type: string;                   // main, server, worker, test, etc.
    framework?: string;
    initializedModules: string[];
    topLevelCalls: Array<{
      symbolName: string;
      filePath: string;
      purpose?: string;             // If detectable
    }>;
  }>;
  summary: {
    totalEntryPoints: number;
    byType: { [type: string]: number };
  };
}
```

**Use Case**: "How does this application start up?"

---

## 5. Architecture Tools

### `get_architecture_overview`

High-level codebase architecture summary.

**Purpose**: Give AI (and developers) the 10,000-foot view.

**Input Parameters**:

```typescript
{
  includeMetrics?: boolean;
  includeModuleGraph?: boolean;
  includePackages?: boolean;
}
```

**Output**:

```typescript
{
  project: {
    namespace: string;
    branch: string;
    primaryLanguages: string[];
    frameworks: string[];
  };
  structure: {
    totalFiles: number;
    totalSymbols: number;
    totalModules: number;
    paradigms: { [paradigm: string]: number };  // Files by paradigm
    moduleTypes: { [type: string]: number };    // Files by module type
  };
  modules: Array<{
    name: string;
    type: string;
    fileCount: number;
    importance: number;             // Based on dependencies
  }>;
  dependencies: {
    internal: {
      totalConnections: number;
      averageDepth: number;
      circularDependencies: number;
    };
    external: {
      totalPackages: number;
      production: number;
      development: number;
      topPackages: Array<{name: string, usageCount: number}>;
    };
  };
  metrics?: {
    codeHealth: {
      orphanedFiles: number;
      circularDependencies: number;
      deeplyNestedFiles: number;
      testCoverage: number;
    };
    complexity: {
      averageDependencyDepth: number;
      maxDependencyDepth: number;
      highImpactFiles: number;      // Files with many dependents
    };
  };
  moduleGraph?: {
    nodes: Array<{id: string, name: string, type: string, size: number}>;
    edges: Array<{from: string, to: string, weight: number}>;
  };
}
```

**Use Case**: "Explain the architecture of this codebase"

---

### `analyze_package_usage`

Deep dive into external dependencies.

**Purpose**: Understand and audit external dependencies.

**Input Parameters**:

```typescript
{
  packageName?: string;             // Analyze specific package
  type?: string[];                  // production, development, etc.
  minUsageCount?: number;           // Filter by usage
  includeVersions?: boolean;
}
```

**Output**:

```typescript
{
  packages: Array<{
    name: string;
    version?: string;
    type: string;
    usageCount: number;
    usedInFiles: string[];
    usedInModules: string[];
    importedSymbols?: string[];     // What's actually used
    isFullyUtilized: boolean;       // Using many symbols vs few
    alternatives?: string[];        // Similar packages in use
  }>;
  summary: {
    totalPackages: number;
    byType: { [type: string]: number };
    heavilyUsed: string[];          // Top 10
    lightlyUsed: string[];          // Bottom 10
    potentialDuplicates: Array<{
      packages: string[];
      reason: string;
    }>;
  };
}
```

**Use Case**: "What packages do we depend on and how are they used?"

---

### `detect_architecture_violations`

Identify violations of common architectural patterns.

**Purpose**: Enforce architectural best practices and detect anti-patterns.

**Input Parameters**:

```typescript
{
  rules?: string[];                 // Specific rules to check
  severity?: string[];              // Filter by severity
}
```

**Output**:

```typescript
{
  violations: Array<{
    rule: string;
    severity: 'info' | 'warning' | 'error';
    description: string;
    locations: Array<{
      filePath: string;
      line?: number;
      context: string;
    }>;
    recommendation: string;
  }>;
  patterns: {
    circularDependencies: number;
    layerViolations: Array<{       // e.g., UI imports from DB
      from: string;
      to: string;
      layer: string;
    }>;
    godClasses: Array<{             // Classes with too many responsibilities
      symbolId: string;
      filePath: string;
      metrics: object;
    }>;
    tightCoupling: Array<{          // Highly coupled modules
      module1: string;
      module2: string;
      connectionCount: number;
    }>;
  };
  summary: {
    totalViolations: number;
    bySeverity: { [severity: string]: number };
    codeHealthScore: number;        // 0-100
  };
}
```

**Use Case**: "Are there any architectural issues I should address?"

---

### `compare_modules`

Compare two modules side-by-side.

**Purpose**: Understand differences in implementation approaches.

**Input Parameters**:

```typescript
{
  module1: string;
  module2: string;
  compareMetrics?: boolean;
  compareDependencies?: boolean;
}
```

**Output**:

```typescript
{
  modules: {
    module1: ModuleSummary;
    module2: ModuleSummary;
  };
  comparison: {
    structure: {
      fileCountDiff: number;
      similarityScore: number;      // 0-1
    };
    patterns: {
      sharedPatterns: string[];
      uniqueToModule1: string[];
      uniqueToModule2: string[];
    };
    dependencies: {
      sharedDependencies: string[];
      uniqueToModule1: string[];
      uniqueToModule2: string[];
    };
    metrics?: {
      complexity: {module1: number, module2: number};
      coupling: {module1: number, module2: number};
      cohesion: {module1: number, module2: number};
    };
  };
  insights: string[];               // AI-friendly observations
}
```

**Use Case**: "How do the auth and payment modules differ in their approach?"

---

## Design Principles

### For AI Context Efficiency

1. **Structured Returns**: All responses use consistent, well-typed schemas that AI can easily parse
2. **Summary First**: Include summary statistics before details for quick scanning
3. **Context Hints**: Include "reason" and "recommendation" fields to guide AI understanding
4. **Confidence Scores**: Where analysis is heuristic, include confidence/certainty scores
5. **Linkage**: Include IDs and paths to enable follow-up queries

### For Extensibility

Each tool follows this pattern (mirroring OOP principles you prefer):

```typescript
interface McpTool {
	name: string;
	description: string;
	inputSchema: JSONSchema;
	execute(params: any): Promise<ToolResult>;
}
```

Tools can be added without modifying existing ones, and complex tools can be composed from simpler ones.

### For Performance

- All tools accept `limit` parameters to control response size
- Indexes cover all common query patterns
- Results include pagination hints for large datasets
- Tools can indicate if results are cached vs. fresh

---

## Priority Implementation Order

Given the goal of maximum immediate value for AI coding assistants:

**Phase 1 (MVP - Maximum Impact)**:

1. `search_symbols` - Core discovery
2. `get_dependencies` - Understanding context
3. `get_dependents` - Impact awareness
4. `impact_analysis` - Comprehensive risk assessment
5. `get_file_details` - Deep understanding

**Phase 2 (Enhanced Capabilities)**: 6. `trace_symbol_usage` - Refactoring support 7. `get_architecture_overview` - Big picture 8. `find_similar_patterns` - Learning from examples 9. `get_module_overview` - Module understanding 10. `get_call_graph` - Execution flow

**Phase 3 (Advanced Features)**: 11. `find_circular_dependencies` - Code health 12. `find_orphaned_code` - Cleanup assistance 13. `get_test_coverage_map` - Testing support 14. Remaining architecture tools
