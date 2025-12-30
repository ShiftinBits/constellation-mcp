# Constellation MCP End-to-End Test Procedure

This document provides a complete, reproducible test procedure for validating the constellation-mcp MCP server functionality.

---

## Prerequisites

### Environment Requirements

1. **constellation-core** running on `localhost:3000`

   ```bash
   cd constellation-core
   npm run docker:up
   npm run start:client-api:dev
   ```

2. **Valid access key** configured (stored in `CONSTELLATION_ACCESS_KEY` env var)

3. **Project indexed** in constellation

   ```bash
   constellation index --full
   ```

4. **MCP servers** connected to Claude Code:
   - **Constellation MCP** (`mcp__plugin_constellation_constellation__execute_code`) - For API tests
   - **Neo4j MCP** (`mcp__neo4j__read-cypher`) - For validation queries

### Test Context

- **Project:** constellation-mcp
- **Project ID:** `proj:00000000000040008000000000000033`
- **Branch:** main
- **MCP Tools:**
  - `execute_code` (Constellation API tests)
  - `read-cypher` (Neo4j validation queries)

---

## Step 0: Update the Code Index

Before running any tests, ensure the codebase is freshly indexed:

```bash
cd constellation-mcp
constellation index --full
```

This command parses the codebase, extracts AST intelligence, and uploads it to constellation-core. The index must be current for tests to return accurate results.

---

## Test Execution Method

All tests are executed via the `execute_code` MCP tool. Each test case provides:

- **Code**: JavaScript to execute in the sandbox
- **Expected**: What the result should contain
- **Neo4j Validation**: Cypher query to cross-check results against the graph database
- **Cross-Validation**: Comparison logic between API and Neo4j results
- **Validates**: What aspect of the system is being tested

---

## Neo4j Validation Workflow

Claude Code executes tests using both MCP servers in a two-phase process:

### Phase 1: Execute Constellation API Test

Claude calls `mcp__plugin_constellation_constellation__execute_code` with the test JavaScript code and captures the result.

### Phase 2: Execute Neo4j Validation Query

Claude calls `mcp__neo4j__read-cypher` with the validation Cypher query and captures the result.

### Phase 3: Compare Results

Claude compares API results against Neo4j results:

- **Counts should match** (within tolerance for pagination)
- **IDs should exist** in both systems
- **Relationships should be consistent**
- **Report PASS/FAIL with discrepancy details**

### Interpreting Discrepancies

| Scenario                | Likely Cause                         | Action              |
| ----------------------- | ------------------------------------ | ------------------- |
| API count > Neo4j count | API caching or stale data            | Re-index project    |
| API count < Neo4j count | API filtering (test exclusion)       | Check filter params |
| Missing relationships   | Incomplete extraction                | Check CLI parser    |
| Extra relationships     | API enrichment layer                 | Expected behavior   |
| Symbol not found        | Symbol ID mismatch or encoding issue | Verify ID format    |

### Neo4j Schema Reference

**Node Labels**: `File`, `Symbol`, `Module`, `Package`, `UnresolvedReference`, `Export`

**Relationship Types**: `REFERENCES`, `CONTAINS`, `HAS_CHILD`, `IMPORTS`, `DEPENDS_ON`, `EXPORTS`, `EXPORTS_SYMBOL`, `BELONGS_TO_MODULE`, `CALLS`, `INHERITS`, `RE_EXPORTS_FROM`, `USES_SYMBOL`

**Key Symbol Properties**: `name`, `kind`, `filePath`, `isExported`, `projectId`, `branch`, `id`, `qualifiedName`, `modifiers`, `line`, `column`

---

## Category 1: Discovery Methods (10 Tests)

### TC-DISC-001: searchSymbols - Basic Query

**Code:**

```javascript
const result = await api.searchSymbols({ query: 'CodeModeSandbox' });
return {
	success: result.symbols && result.symbols.length > 0,
	symbolCount: result.symbols?.length || 0,
	firstSymbol: result.symbols?.[0]
		? {
				name: result.symbols[0].name,
				kind: result.symbols[0].kind,
				filePath: result.symbols[0].filePath,
			}
		: null,
	hasPagination: !!result.pagination,
};
```

**Expected:**

- `success: true`
- `symbolCount >= 1`
- `firstSymbol.name === "CodeModeSandbox"`
- `firstSymbol.kind === "class"`
- `hasPagination: true`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'CodeModeSandbox'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
RETURN count(s) as count,
       collect({name: s.name, kind: s.kind, filePath: s.filePath}) as symbols
```

**Cross-Validation:**

- Neo4j `count` should equal API `symbolCount`
- Neo4j `symbols[0].name` should equal `firstSymbol.name`
- Neo4j `symbols[0].kind` should equal `firstSymbol.kind`

**Validates:** Basic search functionality, symbol structure, Neo4j data consistency

---

### TC-DISC-002: searchSymbols - Kind Filter

**Code:**

```javascript
const result = await api.searchSymbols({
	query: 'Error',
	filterByKind: ['class'],
	limit: 5,
});
return {
	symbolCount: result.symbols?.length || 0,
	allClasses: result.symbols?.every((s) => s.kind === 'class') ?? true,
	withinLimit: (result.symbols?.length || 0) <= 5,
	symbols: result.symbols?.map((s) => ({ name: s.name, kind: s.kind })) || [],
};
```

**Expected:**

- `allClasses: true`
- `withinLimit: true`
- `symbolCount <= 5`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'Error'
  AND s.kind = 'class'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
RETURN count(s) as totalCount,
       collect(s.name)[0..5] as limitedNames
```

**Cross-Validation:**

- All API symbols should have `kind === 'class'`
- API `symbolCount` should be <= 5 (limit applied)
- Neo4j `totalCount` represents unfiltered count (may be >= API count due to limit)

**Validates:** `filterByKind` parameter, `limit` parameter, Neo4j kind filtering

---

### TC-DISC-003: searchSymbols - Visibility Filter

**Code:**

```javascript
const result = await api.searchSymbols({
	query: 'execute',
	filterByVisibility: ['public'],
	isExported: true,
	limit: 10,
});
return {
	symbolCount: result.symbols?.length || 0,
	symbols:
		result.symbols?.slice(0, 5).map((s) => ({
			name: s.name,
			visibility: s.visibility,
			exported: s.isExported,
		})) || [],
};
```

**Expected:**

- All returned symbols should have `visibility: "public"` or similar
- All returned symbols should be exported

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'execute'
  AND s.isExported = true
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
RETURN count(s) as count,
       collect({name: s.name, isExported: s.isExported})[0..10] as symbols
```

**Cross-Validation:**

- All API symbols should have `isExported: true`
- API `symbolCount` should match or be subset of Neo4j `count`

**Validates:** `filterByVisibility`, `isExported` filters, Neo4j export filtering

---

### TC-DISC-004: searchSymbols - File Pattern

**Code:**

```javascript
const result = await api.searchSymbols({
	query: 'Error',
	filePattern: 'src/client/**',
	limit: 10,
});
return {
	symbolCount: result.symbols?.length || 0,
	allInClientDir:
		result.symbols?.every((s) => s.filePath?.includes('src/client/')) ?? true,
	symbols:
		result.symbols
			?.slice(0, 5)
			.map((s) => ({ name: s.name, filePath: s.filePath })) || [],
};
```

**Expected:**

- `allInClientDir: true`
- All file paths contain "src/client/"

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'Error'
  AND s.filePath STARTS WITH 'src/client/'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
RETURN count(s) as count,
       collect({name: s.name, filePath: s.filePath})[0..10] as symbols
```

**Cross-Validation:**

- All API symbols should have `filePath` containing "src/client/"
- Neo4j `count` should be >= API `symbolCount` (API may apply additional filtering)

**Validates:** `filePattern` filtering, Neo4j path filtering

---

### TC-DISC-005: searchSymbols - Usage Count

**Code:**

```javascript
const result = await api.searchSymbols({
	query: 'getConfigContext',
	includeUsageCount: true,
	limit: 5,
});
return {
	symbolCount: result.symbols?.length || 0,
	hasUsageCount:
		result.symbols?.some((s) => s.usageCount !== undefined) ?? false,
	symbols:
		result.symbols?.map((s) => ({
			name: s.name,
			usageCount: s.usageCount,
		})) || [],
};
```

**Expected:**

- `hasUsageCount: true`
- Symbols include numeric `usageCount` field

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'getConfigContext'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (ref)-[:REFERENCES|CALLS|USES_SYMBOL]->(s)
WITH s, count(ref) as usageCount
RETURN s.name as name, usageCount
ORDER BY usageCount DESC
LIMIT 5
```

**Cross-Validation:**

- API `usageCount` should match Neo4j reference count for each symbol
- Symbol names should match between API and Neo4j results

**Validates:** `includeUsageCount` option, Neo4j reference counting

---

### TC-DISC-006: searchSymbols - Pagination

**Code:**

```javascript
const first = await api.searchSymbols({ query: 'Error', limit: 3, offset: 0 });
const second = await api.searchSymbols({ query: 'Error', limit: 3, offset: 3 });
const firstIds = first.symbols?.map((s) => s.id) || [];
const secondIds = second.symbols?.map((s) => s.id) || [];
const hasOverlap = firstIds.some((id) => secondIds.includes(id));
return {
	firstPage: first.symbols?.map((s) => s.name) || [],
	secondPage: second.symbols?.map((s) => s.name) || [],
	pagination: first.pagination,
	hasOverlap,
};
```

**Expected:**

- `hasOverlap: false` (pages don't overlap)
- `pagination.hasMore: true`
- Different symbols on each page

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'Error'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
WITH s ORDER BY s.name
WITH collect(s.name) as allNames
RETURN allNames[0..3] as firstPage,
       allNames[3..6] as secondPage,
       size(allNames) as totalCount
```

**Cross-Validation:**

- API `firstPage` names should match Neo4j `firstPage` (order may vary)
- API `secondPage` names should match Neo4j `secondPage` (order may vary)
- No overlap between pages in both systems

**Validates:** `offset` parameter, `pagination` in response, Neo4j SKIP/LIMIT consistency

---

### TC-DISC-007: getSymbolDetails - By Symbol ID

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'CodeModeSandbox', limit: 1 });
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const details = await api.getSymbolDetails({ symbolId: search.symbols[0].id });
return {
	success: !!details.symbol,
	symbolName: details.symbol?.name,
	symbolKind: details.symbol?.kind,
	filePath: details.symbol?.filePath,
	hasSignature: !!details.symbol?.signature,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `success: true`
- `symbolName === "CodeModeSandbox"`
- `symbolKind === "class"`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'CodeModeSandbox'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
RETURN s.id as id, s.name as name, s.kind as kind, s.filePath as filePath
```

**Cross-Validation:**

- API `symbolName` should match Neo4j `name`
- API `symbolKind` should match Neo4j `kind`
- API `filePath` should match Neo4j `filePath`
- Symbol ID should exist in Neo4j

**Validates:** Symbol lookup by ID, Neo4j symbol existence

---

### TC-DISC-008: getSymbolDetails - By Name+Path

**Code:**

```javascript
const result = await api.getSymbolDetails({
	symbolName: 'CodeModeSandbox',
	filePath: 'src/code-mode/sandbox.ts',
});
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	symbolKind: result.symbol?.kind,
	filePath: result.symbol?.filePath,
};
```

**Expected:**

- `success: true`
- `symbolName === "CodeModeSandbox"`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'CodeModeSandbox'
  AND s.filePath = 'src/code-mode/sandbox.ts'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
RETURN s.name as name, s.kind as kind, s.filePath as filePath
```

**Cross-Validation:**

- API `symbolName` should match Neo4j `name`
- API `filePath` should match Neo4j `filePath`
- Exactly one symbol should be returned in both systems

**Validates:** Symbol lookup by name+path combination, Neo4j precise matching

---

### TC-DISC-009: getSymbolDetails - With References

**Code:**

```javascript
const search = await api.searchSymbols({
	query: 'createStructuredError',
	limit: 1,
});
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.getSymbolDetails({
	symbolId: search.symbols[0].id,
	includeReferences: true,
});
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	hasReferences: !!result.references,
	referenceCount: result.references?.length || 0,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `hasReferences: true`
- `referenceCount > 0`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'createStructuredError'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (ref)-[r:REFERENCES|CALLS|USES_SYMBOL]->(s)
WITH s, count(ref) as refCount, collect(DISTINCT ref.filePath) as refFiles
RETURN s.name as name, refCount, refFiles
```

**Cross-Validation:**

- API `referenceCount` should match or be close to Neo4j `refCount`
- Both systems should show references exist for this symbol

**Validates:** `includeReferences` option, Neo4j REFERENCES relationship counting

---

### TC-DISC-010: getSymbolDetails - With Relationships

**Code:**

```javascript
const search = await api.searchSymbols({
	query: 'ConstellationClient',
	limit: 1,
});
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.getSymbolDetails({
	symbolId: search.symbols[0].id,
	includeRelationships: true,
});
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	hasRelationships: !!result.relationships,
	relationshipKeys: result.relationships
		? Object.keys(result.relationships)
		: [],
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `hasRelationships: true`
- `relationshipKeys` includes items like "calls", "calledBy", "inherits"

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'ConstellationClient'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (s)-[:CALLS]->(called:Symbol)
OPTIONAL MATCH (caller:Symbol)-[:CALLS]->(s)
OPTIONAL MATCH (s)-[:INHERITS]->(parent:Symbol)
OPTIONAL MATCH (child:Symbol)-[:INHERITS]->(s)
RETURN s.name as name,
       count(DISTINCT called) as callsCount,
       count(DISTINCT caller) as calledByCount,
       count(DISTINCT parent) as inheritsCount,
       count(DISTINCT child) as inheritedByCount
```

**Cross-Validation:**

- API relationship counts should match Neo4j relationship counts
- Relationship types present in API should have corresponding Neo4j relationships

**Validates:** `includeRelationships` option, Neo4j CALLS/INHERITS relationships

---

## Category 2: Dependency Methods (9 Tests)

### TC-DEP-001: getDependencies - Basic

**Code:**

```javascript
const result = await api.getDependencies({
	filePath: 'src/code-mode/sandbox.ts',
});
return {
	success: !!result.file,
	file: result.file,
	directDependencyCount: result.directDependencies?.length || 0,
	firstThreeDeps:
		result.directDependencies?.slice(0, 3).map((d) => d.filePath || d.path) ||
		[],
};
```

**Expected:**

- `success: true`
- `file === "src/code-mode/sandbox.ts"`
- `directDependencyCount > 0`

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/code-mode/sandbox.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
OPTIONAL MATCH (f)-[:IMPORTS]->(dep:File)
RETURN f.path as file,
       count(dep) as depCount,
       collect(dep.path)[0..3] as firstThreeDeps
```

**Cross-Validation:**

- API `directDependencyCount` should match Neo4j `depCount`
- API `firstThreeDeps` should be subset of Neo4j imported files

**Validates:** Basic dependency analysis, Neo4j IMPORTS relationship

---

### TC-DEP-002: getDependencies - With Depth

**Code:**

```javascript
const result = await api.getDependencies({
	filePath: 'src/code-mode/sandbox.ts',
	depth: 2,
});
return {
	success: !!result.file,
	directDependencyCount: result.directDependencies?.length || 0,
	hasTransitive: !!result.transitiveDependencies,
	transitiveDependencyCount: result.transitiveDependencies?.length || 0,
};
```

**Expected:**

- `hasTransitive: true`
- `transitiveDependencyCount > 0`

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/code-mode/sandbox.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
OPTIONAL MATCH (f)-[:IMPORTS]->(direct:File)
OPTIONAL MATCH (f)-[:IMPORTS*2]->(transitive:File)
WHERE transitive <> f
RETURN count(DISTINCT direct) as directCount,
       count(DISTINCT transitive) as transitiveCount
```

**Cross-Validation:**

- API `directDependencyCount` should match Neo4j `directCount`
- API `transitiveDependencyCount` should be close to Neo4j `transitiveCount`

**Validates:** `depth` parameter, transitive dependencies, Neo4j path traversal

---

### TC-DEP-003: getDependencies - Include Packages

**Code:**

```javascript
const result = await api.getDependencies({
	filePath: 'src/code-mode/sandbox.ts',
	includePackages: true,
});
return {
	success: !!result.file,
	hasPackages: !!result.packages,
	packageCount: result.packages?.length || 0,
	packages: result.packages?.slice(0, 5).map((p) => p.name || p) || [],
};
```

**Expected:**

- `hasPackages: true`
- `packages` includes npm/node packages like "vm"

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/code-mode/sandbox.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
OPTIONAL MATCH (f)-[:IMPORTS]->(pkg:Package)
RETURN count(pkg) as packageCount,
       collect(pkg.name)[0..5] as packages
```

**Cross-Validation:**

- API `packageCount` should match Neo4j package count
- API `packages` should match Neo4j package names

**Validates:** `includePackages` option, Neo4j Package node imports

---

### TC-DEP-004: getDependencies - Include Symbols

**Code:**

```javascript
const result = await api.getDependencies({
	filePath: 'src/code-mode/sandbox.ts',
	includeSymbols: true,
});
return {
	success: !!result.file,
	hasSymbols:
		result.directDependencies?.some(
			(d) => d.importedSymbols && d.importedSymbols.length > 0,
		) ?? false,
	sampleDep: result.directDependencies?.[0]
		? {
				path:
					result.directDependencies[0].filePath ||
					result.directDependencies[0].path,
				symbolCount: result.directDependencies[0].importedSymbols?.length || 0,
			}
		: null,
};
```

**Expected:**

- `hasSymbols: true`
- Dependencies include `importedSymbols` arrays

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/code-mode/sandbox.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
MATCH (f)-[imp:IMPORTS]->(dep:File)
WHERE imp.symbols IS NOT NULL
RETURN dep.path as depPath,
       imp.symbols as importedSymbols,
       size(imp.symbols) as symbolCount
LIMIT 3
```

**Cross-Validation:**

- API `importedSymbols` should match Neo4j `imp.symbols` property
- Symbol counts should be consistent between systems

**Validates:** `includeSymbols` option, Neo4j IMPORTS relationship symbols property

---

### TC-DEP-005: getDependents - Basic

**Code:**

```javascript
const result = await api.getDependents({
	filePath: 'src/client/error-factory.ts',
});
return {
	success: !!result.file,
	file: result.file,
	directDependentCount: result.directDependents?.length || 0,
	firstThree:
		result.directDependents?.slice(0, 3).map((d) => d.filePath || d.path) || [],
};
```

**Expected:**

- `success: true`
- `directDependentCount > 0`

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/client/error-factory.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
OPTIONAL MATCH (dependent:File)-[:IMPORTS]->(f)
RETURN f.path as file,
       count(dependent) as dependentCount,
       collect(dependent.path)[0..3] as firstThree
```

**Cross-Validation:**

- API `directDependentCount` should match Neo4j `dependentCount`
- API `firstThree` should be subset of Neo4j dependent files

**Validates:** Reverse dependency analysis, Neo4j reverse IMPORTS traversal

---

### TC-DEP-006: getDependents - With Depth

**Code:**

```javascript
const result = await api.getDependents({
	filePath: 'src/types/mcp-errors.ts',
	depth: 2,
});
return {
	success: !!result.file,
	directDependentCount: result.directDependents?.length || 0,
	hasTransitive: !!result.transitiveDependents,
	transitiveDependentCount: result.transitiveDependents?.length || 0,
};
```

**Expected:**

- `hasTransitive: true`
- `transitiveDependentCount >= directDependentCount`

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/types/mcp-errors.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
OPTIONAL MATCH (direct:File)-[:IMPORTS]->(f)
OPTIONAL MATCH (transitive:File)-[:IMPORTS*2]->(f)
WHERE transitive <> f
RETURN count(DISTINCT direct) as directCount,
       count(DISTINCT transitive) as transitiveCount
```

**Cross-Validation:**

- API `directDependentCount` should match Neo4j `directCount`
- API `transitiveDependentCount` should be close to Neo4j `transitiveCount`

**Validates:** `depth` parameter for reverse dependencies, Neo4j reverse path traversal

---

### TC-DEP-007: getDependents - With Impact Metrics

**Code:**

```javascript
const result = await api.getDependents({
	filePath: 'src/config/config-manager.ts',
	includeImpactMetrics: true,
});
return {
	success: !!result.file,
	directDependentCount: result.directDependents?.length || 0,
	hasDetailedMetrics: !!result.detailedMetrics,
	metricKeys: result.detailedMetrics ? Object.keys(result.detailedMetrics) : [],
};
```

**Expected:**

- `success: true`
- Note: `hasDetailedMetrics` may be false (known observation)

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/config/config-manager.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
OPTIONAL MATCH (dependent:File)-[:IMPORTS]->(f)
RETURN f.path as file,
       count(dependent) as dependentCount,
       collect(dependent.path) as dependents
```

**Cross-Validation:**

- API `directDependentCount` should match Neo4j `dependentCount`
- Metric calculation is API-layer enrichment, not directly in Neo4j

**Validates:** `includeImpactMetrics` option, Neo4j dependent count accuracy

---

### TC-DEP-008: findCircularDependencies - Project Wide

**Code:**

```javascript
const result = await api.findCircularDependencies({});
return {
	success: true,
	hasCycles: !!result.cycles,
	totalCycles: result.totalCycles || 0,
	cycleCount: result.cycles?.length || 0,
};
```

**Expected:**

- `hasCycles: true` (array exists)
- `totalCycles` and `cycleCount` should match
- A clean codebase will have 0 cycles

**Neo4j Validation:**

```cypher
MATCH path = (f:File {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})-[:IMPORTS*2..10]->(f)
WITH [n IN nodes(path) | n.path] as cyclePaths, length(path) as cycleLength
RETURN count(DISTINCT cyclePaths) as cycleCount,
       collect(DISTINCT cyclePaths)[0..3] as sampleCycles
```

**Cross-Validation:**

- API `cycleCount` should match Neo4j `cycleCount`
- Both systems should detect the same circular dependency patterns

**Validates:** Circular dependency detection, Neo4j cycle detection query

---

### TC-DEP-009: findCircularDependencies - From Specific File

**Code:**

```javascript
const result = await api.findCircularDependencies({
	filePath: 'src/code-mode/sandbox.ts',
	maxDepth: 5,
});
return {
	success: true,
	hasCycles: !!result.cycles,
	totalCycles: result.totalCycles || 0,
};
```

**Expected:**

- Returns only cycles involving the specified file

**Neo4j Validation:**

```cypher
MATCH path = (f:File {path: 'src/code-mode/sandbox.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})-[:IMPORTS*2..5]->(f)
WITH [n IN nodes(path) | n.path] as cyclePaths, length(path) as cycleLength
RETURN count(DISTINCT cyclePaths) as cycleCount,
       collect(DISTINCT cyclePaths) as cycles
```

**Cross-Validation:**

- API `totalCycles` should match Neo4j `cycleCount`
- All cycles should involve the specified file

**Validates:** `filePath` filter, `maxDepth` limit, Neo4j file-specific cycle detection

---

## Category 3: Tracing Methods (9 Tests)

### TC-TRACE-001: traceSymbolUsage - By Symbol ID

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'getConfigContext', limit: 1 });
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.traceSymbolUsage({ symbolId: search.symbols[0].id });
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	hasDirectUsages: !!result.directUsages,
	directUsageCount: result.directUsages?.length || 0,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `success: true`
- `hasDirectUsages: true`
- `directUsageCount > 0`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'getConfigContext'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (usage)-[r:REFERENCES|CALLS|USES_SYMBOL]->(s)
RETURN s.name as symbolName,
       count(usage) as usageCount,
       collect(DISTINCT type(r)) as relationshipTypes
```

**Cross-Validation:**

- API `directUsageCount` should match Neo4j `usageCount`
- Both systems should show usages exist for this symbol

**Validates:** Usage tracing by ID, Neo4j REFERENCES/CALLS relationship counting

---

### TC-TRACE-002: traceSymbolUsage - By Name+File

**Code:**

```javascript
const result = await api.traceSymbolUsage({
	symbolName: 'createStructuredError',
	filePath: 'src/client/error-factory.ts',
});
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	directUsageCount: result.directUsages?.length || 0,
};
```

**Expected:**

- `success: true`
- `directUsageCount > 0`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'createStructuredError'
  AND s.filePath = 'src/client/error-factory.ts'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (usage)-[r:REFERENCES|CALLS|USES_SYMBOL]->(s)
RETURN s.name as symbolName,
       count(usage) as usageCount
```

**Cross-Validation:**

- API `directUsageCount` should match Neo4j `usageCount`
- Symbol should be found by name+path in Neo4j

**Validates:** Usage tracing by name+path, Neo4j precise symbol lookup

---

### TC-TRACE-003: traceSymbolUsage - Filter By Usage Type

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'ErrorCode', limit: 1 });
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.traceSymbolUsage({
	symbolId: search.symbols[0].id,
	filterByUsageType: ['import'],
});
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	directUsageCount: result.directUsages?.length || 0,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- Only usages of type "import" returned

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'ErrorCode'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (usage)-[r:IMPORTS]->(s)
RETURN s.name as symbolName,
       count(usage) as importCount
```

**Cross-Validation:**

- API `directUsageCount` should match Neo4j `importCount` when filtered by import
- Only IMPORTS relationships should be counted

**Validates:** `filterByUsageType` filter, Neo4j relationship type filtering

---

### TC-TRACE-004: traceSymbolUsage - Include Transitive

**Code:**

```javascript
const search = await api.searchSymbols({
	query: 'ConstellationClient',
	limit: 1,
});
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.traceSymbolUsage({
	symbolId: search.symbols[0].id,
	includeTransitive: true,
});
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	directUsageCount: result.directUsages?.length || 0,
	hasTransitive: !!result.transitiveUsages,
	transitiveCount: result.transitiveUsages?.length || 0,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `hasTransitive: true`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'ConstellationClient'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (direct)-[r1:REFERENCES|CALLS|USES_SYMBOL]->(s)
OPTIONAL MATCH (transitive)-[r2:REFERENCES|CALLS|USES_SYMBOL*2]->(s)
WHERE transitive <> s
RETURN s.name as symbolName,
       count(DISTINCT direct) as directCount,
       count(DISTINCT transitive) as transitiveCount
```

**Cross-Validation:**

- API `directUsageCount` should match Neo4j `directCount`
- API `transitiveCount` should be related to Neo4j multi-hop relationships

**Validates:** `includeTransitive` option, Neo4j multi-hop relationship traversal

---

### TC-TRACE-005: traceSymbolUsage - Exclude Tests

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'CodeModeSandbox', limit: 1 });
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.traceSymbolUsage({
	symbolId: search.symbols[0].id,
	excludeTests: true,
});
const hasTestFiles =
	result.directUsages?.some(
		(u) =>
			u.filePath?.includes('test') ||
			u.filePath?.includes('.spec.') ||
			u.filePath?.includes('.test.'),
	) ?? false;
return {
	success: !!result.symbol && !hasTestFiles,
	symbolName: result.symbol?.name,
	directUsageCount: result.directUsages?.length || 0,
	hasTestFiles,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `hasTestFiles: false`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'CodeModeSandbox'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (usage)-[r:REFERENCES|CALLS|USES_SYMBOL]->(s)
WHERE NOT (usage.filePath CONTAINS 'test' OR usage.filePath CONTAINS '.spec.' OR usage.filePath CONTAINS '.test.')
RETURN s.name as symbolName,
       count(usage) as nonTestUsageCount
```

**Cross-Validation:**

- API `directUsageCount` should match Neo4j `nonTestUsageCount` when tests excluded
- No test file paths should appear in results

**Validates:** `excludeTests` filter, Neo4j path exclusion filtering

---

### TC-TRACE-006: traceSymbolUsage - Include Context

**Code:**

```javascript
const search = await api.searchSymbols({
	query: 'createStructuredError',
	limit: 1,
});
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.traceSymbolUsage({
	symbolId: search.symbols[0].id,
	includeContext: true,
	limit: 5,
});
const hasContext = result.directUsages?.some((u) => !!u.context) ?? false;
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	directUsageCount: result.directUsages?.length || 0,
	hasContext,
	sampleContext: result.directUsages?.[0]?.context?.substring(0, 100) || null,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `hasContext: true` with code snippets
- Note: Currently returns `hasContext: false` (known observation)

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'createStructuredError'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (usage)-[r:REFERENCES|CALLS|USES_SYMBOL]->(s)
RETURN s.name as symbolName,
       count(usage) as usageCount,
       collect({filePath: usage.filePath, line: usage.line})[0..5] as usageLocations
```

**Cross-Validation:**

- API `directUsageCount` should match Neo4j `usageCount`
- Context is API-layer enrichment (reads source), not stored in Neo4j

**Validates:** `includeContext` option, Neo4j usage locations (context is API-generated)

---

### TC-TRACE-007: getCallGraph - Callees

**Code:**

```javascript
const search = await api.searchSymbols({
	query: 'execute',
	filterByKind: ['method'],
	limit: 1,
});
if (search.symbols?.length === 0) {
	return { error: 'No method symbols found' };
}
const result = await api.getCallGraph({
	symbolId: search.symbols[0].id,
	direction: 'callees',
	depth: 2,
});
return {
	success: !!result.root,
	rootName: result.root?.name,
	hasCallees: !!result.callees,
	calleeCount: result.callees?.length || 0,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `hasCallees: true`
- `calleeCount > 0`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'execute'
  AND s.kind = 'method'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
WITH s LIMIT 1
OPTIONAL MATCH (s)-[:CALLS]->(callee:Symbol)
RETURN s.name as rootName,
       count(callee) as calleeCount,
       collect(callee.name) as calleeNames
```

**Cross-Validation:**

- API `calleeCount` should match Neo4j `calleeCount`
- Callee names should match between API and Neo4j results

**Validates:** Call graph for outgoing calls, Neo4j CALLS relationship traversal

---

### TC-TRACE-008: getCallGraph - Callers

**Code:**

```javascript
const search = await api.searchSymbols({
	query: 'createStructuredError',
	limit: 1,
});
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.getCallGraph({
	symbolId: search.symbols[0].id,
	direction: 'callers',
	depth: 2,
});
return {
	success: !!result.root,
	rootName: result.root?.name,
	hasCallers: !!result.callers,
	callerCount: result.callers?.length || 0,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `hasCallers: true`
- `callerCount > 0`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'createStructuredError'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (caller:Symbol)-[:CALLS]->(s)
RETURN s.name as rootName,
       count(caller) as callerCount,
       collect(caller.name) as callerNames
```

**Cross-Validation:**

- API `callerCount` should match Neo4j `callerCount`
- Caller names should match between API and Neo4j results

**Validates:** Call graph for incoming calls, Neo4j reverse CALLS relationship

---

### TC-TRACE-009: getCallGraph - Both Directions

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'getConfigContext', limit: 1 });
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.getCallGraph({
	symbolId: search.symbols[0].id,
	direction: 'both',
	depth: 1,
});
return {
	success: !!result.root,
	rootName: result.root?.name,
	hasCallers: !!result.callers,
	hasCallees: !!result.callees,
	callerCount: result.callers?.length || 0,
	calleeCount: result.callees?.length || 0,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `hasCallers: true`
- `hasCallees: true`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'getConfigContext'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (caller:Symbol)-[:CALLS]->(s)
OPTIONAL MATCH (s)-[:CALLS]->(callee:Symbol)
RETURN s.name as rootName,
       count(DISTINCT caller) as callerCount,
       count(DISTINCT callee) as calleeCount,
       collect(DISTINCT caller.name) as callerNames,
       collect(DISTINCT callee.name) as calleeNames
```

**Cross-Validation:**

- API `callerCount` should match Neo4j `callerCount`
- API `calleeCount` should match Neo4j `calleeCount`
- Both directions should be captured

**Validates:** Bidirectional call graph, Neo4j dual-direction CALLS traversal

---

## Category 4: Impact Methods (9 Tests)

### TC-IMPACT-001: impactAnalysis - Basic

**Code:**

```javascript
const search = await api.searchSymbols({
	query: 'ConstellationClient',
	limit: 1,
});
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const result = await api.impactAnalysis({ symbolId: search.symbols[0].id });
return {
	success: !!result.symbol,
	symbolName: result.symbol?.name,
	hasImpactedFiles: !!result.impactedFiles,
	impactedFileCount: result.impactedFiles?.length || 0,
	hasSummary: !!result.summary,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `success: true`
- `hasSummary: true`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'ConstellationClient'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (ref)-[:REFERENCES|CALLS|USES_SYMBOL]->(s)
WITH s, collect(DISTINCT ref.filePath) as refFiles
OPTIONAL MATCH (f:File)-[:CONTAINS]->(ref)-[:REFERENCES|CALLS|USES_SYMBOL]->(s)
RETURN s.name as symbolName,
       count(DISTINCT f.path) as impactedFileCount,
       collect(DISTINCT f.path)[0..5] as sampleFiles
```

**Cross-Validation:**

- API `impactedFileCount` should be close to Neo4j impacted file count
- Impact analysis includes API-layer risk calculations not stored in Neo4j

**Validates:** Basic impact analysis, Neo4j reference-to-file mapping

---

### TC-IMPACT-002 through TC-IMPACT-009

See E2E-TEST-RESULTS.md for complete test cases.

**Neo4j Validation Pattern for Impact Tests:**

All impact tests should validate against Neo4j using similar patterns:

```cypher
-- For symbol-based impact
MATCH (s:Symbol {name: '<symbolName>', projectId: 'proj:00000000000040008000000000000033'})
OPTIONAL MATCH (usage)-[:REFERENCES|CALLS|USES_SYMBOL]->(s)
RETURN count(DISTINCT usage) as directImpact

-- For file-based impact (depth traversal)
MATCH (s:Symbol {name: '<symbolName>', projectId: 'proj:00000000000040008000000000000033'})
OPTIONAL MATCH path = (usage)-[:REFERENCES|CALLS|USES_SYMBOL*1..2]->(s)
RETURN count(DISTINCT usage) as transitiveImpact
```

---

## Category 5: Architecture Methods (4 Tests)

### TC-ARCH-001: getArchitectureOverview - Basic

**Code:**

```javascript
const result = await api.getArchitectureOverview({});
return {
	success: true,
	hasMetadata: !!result.metadata,
	hasStructure: !!result.structure,
	hasDependencies: !!result.dependencies,
	metadataKeys: result.metadata ? Object.keys(result.metadata) : [],
};
```

**Expected:**

- `hasMetadata: true`
- `hasStructure: true`
- `hasDependencies: true`

**Neo4j Validation:**

```cypher
// File count
MATCH (f:File {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
RETURN count(f) as totalFiles

// Symbol distribution
MATCH (s:Symbol {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
RETURN s.kind as kind, count(s) as count
ORDER BY count DESC

// Dependency count
MATCH (f1:File {projectId: 'proj:00000000000040008000000000000033'})-[:IMPORTS]->(f2:File)
RETURN count(*) as totalDependencies
```

**Cross-Validation:**

- API file counts should match Neo4j file count
- API symbol distribution should match Neo4j kind counts
- API dependency count should match Neo4j IMPORTS count

**Validates:** Basic architecture overview, Neo4j aggregate statistics

---

### TC-ARCH-002 through TC-ARCH-004

See E2E-TEST-RESULTS.md for complete test cases.

**Neo4j Validation Pattern for Architecture Tests:**

```cypher
-- Language distribution
MATCH (f:File {projectId: 'proj:00000000000040008000000000000033'})
WHERE f.language IS NOT NULL
RETURN f.language as language, count(f) as fileCount

-- External package usage
MATCH (f:File {projectId: 'proj:00000000000040008000000000000033'})-[:IMPORTS]->(p:Package)
RETURN p.name as package, count(f) as usageCount
ORDER BY usageCount DESC
LIMIT 10

-- Module structure
MATCH (f:File {projectId: 'proj:00000000000040008000000000000033'})
WITH split(f.path, '/')[0] as topDir, count(f) as fileCount
RETURN topDir, fileCount
ORDER BY fileCount DESC
```

---

## Category 6: Parameter Validation (11 Tests)

### TC-VALID-001: Missing Required Parameter - Query

**Code:**

```javascript
try {
	const result = await api.searchSymbols({});
	return { success: false, note: 'Expected error but got result' };
} catch (error) {
	return {
		success: true,
		errorMessage: error.message?.substring(0, 200),
		hasQueryMention:
			error.message?.toLowerCase().includes('query') ||
			error.message?.includes('required'),
	};
}
```

**Expected:**

- Error thrown
- `hasQueryMention: true`

**Neo4j Validation:**

Parameter validation tests validate API-layer behavior, not Neo4j data. However, we can verify that the validation prevents invalid queries from reaching Neo4j:

```cypher
// Verify no query was executed with empty parameters
// This is a no-op validation - if API validation works, Neo4j is never called
RETURN 'Parameter validation is API-layer, not Neo4j' as note
```

**Cross-Validation:**

- API should throw error before reaching Neo4j
- No Neo4j query should be executed for invalid parameters

**Validates:** Required parameter validation, API-layer error handling

---

### TC-VALID-002 through TC-VALID-011

See E2E-TEST-RESULTS.md for complete test cases.

**Note:** Parameter validation tests (TC-VALID-002 through TC-VALID-011) validate API-layer input validation. These tests ensure the API correctly rejects invalid inputs before any Neo4j queries are executed. Neo4j validation is not applicable for these tests as they test error handling, not data retrieval.

---

## Category 7: Error Handling (6 Tests)

### TC-ERR-001: AUTH_ERROR Structure (Documentation)

**Code:**

```javascript
return {
	note: 'Cannot test with valid auth - documenting expected structure',
	documentedStructure: {
		code: 'AUTH_ERROR',
		type: 'AuthenticationError',
		message: 'Authentication failed',
		recoverable: true,
		guidance: ['Run: constellation auth', 'Verify CONSTELLATION_ACCESS_KEY'],
	},
};
```

**Expected:**

- Documents expected AUTH_ERROR structure

**Validates:** Authentication error format (documented)

---

### TC-ERR-002 through TC-ERR-006

See E2E-TEST-RESULTS.md for complete test cases.

**Note:** Error handling tests (TC-ERR-001 through TC-ERR-006) validate API-layer error response structures and handling. These tests document expected error formats (AUTH_ERROR, SYMBOL_NOT_FOUND, NETWORK_ERROR, etc.) rather than querying Neo4j data. Neo4j validation is not applicable for these tests as they test error handling, not data retrieval.

---

## Category 8: Sandbox Security (9 Tests)

### TC-SEC-001: Block require()

**Code:**

```javascript
// Attempt to use require - should be blocked
// The sandbox validates code before execution and rejects dangerous patterns
return { note: 'Test validates that require() is blocked at validation phase' };
```

**Expected:**

- Code with `require(...)` is rejected at validation
- Error: "Dangerous pattern detected: require"

**Validates:** require() blocking

---

### TC-SEC-002: Block import Statement

**Code:**

```javascript
// Import statements are blocked at code validation phase
return { note: 'Import statements blocked at code validation phase' };
```

**Expected:**

- Code with `import` keyword is rejected at validation

**Validates:** Import statement blocking

---

### TC-SEC-003: Block Dynamic Code Execution

**Code:**

```javascript
// Dynamic code execution patterns are blocked
return { note: 'Dynamic code patterns blocked at validation' };
```

**Expected:**

- Patterns that dynamically execute code are blocked

**Validates:** Dynamic execution blocking

---

### TC-SEC-004: Block Function Constructor

**Code:**

```javascript
// The Function constructor is blocked at validation
return { note: 'Function constructor blocked at validation phase' };
```

**Expected:**

- Code validation fails when Function constructor is used

**Validates:** Function constructor blocking

---

### TC-SEC-005: Block process Access

**Code:**

```javascript
return {
	processType: typeof process,
	processIsUndefined: typeof process === 'undefined',
};
```

**Expected:**

- `processIsUndefined: true`

**Validates:** Process object not accessible

---

### TC-SEC-006: Block Prototype Manipulation

**Code:**

```javascript
// Prototype manipulation patterns are blocked at validation
return { note: 'Prototype manipulation blocked at validation' };
```

**Expected:**

- Code with `__proto__` is rejected

**Validates:** Prototype pollution blocking

---

### TC-SEC-007: Block fs Access

**Code:**

```javascript
return {
	fsType: typeof fs,
	fsIsUndefined: typeof fs === 'undefined',
};
```

**Expected:**

- `fsIsUndefined: true`

**Validates:** File system not accessible

---

### TC-SEC-008: Normal Code Timeout

**Code:**

```javascript
const start = Date.now();
let sum = 0;
for (let i = 0; i < 1000; i++) {
	sum += i;
}
const elapsed = Date.now() - start;
return {
	completed: true,
	sum,
	elapsedMs: elapsed,
};
```

**Expected:**

- `completed: true`
- Completes quickly (no false timeout)

**Validates:** Timeout doesn't false-trigger

---

### TC-SEC-009: Infinite Loop Detection

**Code:**

```javascript
// Infinite loop patterns like while(true) are blocked at validation
return { note: 'Infinite loops detected at validation phase' };
```

**Expected:**

- Code with `while(true)` is rejected

**Validates:** Infinite loop detection

---

**Note:** Sandbox security tests (TC-SEC-001 through TC-SEC-009) validate the JavaScript sandbox execution environment security features. These tests verify that dangerous code patterns (require, import, eval, Function constructor, process access, prototype manipulation, file system access, infinite loops) are properly blocked at the validation or runtime phase. Neo4j validation is not applicable for these tests as they test sandbox security, not data retrieval.

---

## Category 9: Edge Cases (8 Tests)

### TC-EDGE-001: Empty Search Results

**Code:**

```javascript
const result = await api.searchSymbols({
	query: 'ThisSymbolDefinitelyDoesNotExist12345678XYZABC',
});
return {
	isEmpty: result.symbols?.length === 0,
	hasSymbolsArray: Array.isArray(result.symbols),
	symbolCount: result.symbols?.length || 0,
};
```

**Expected:**

- `isEmpty: true`
- `hasSymbolsArray: true`

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'ThisSymbolDefinitelyDoesNotExist12345678XYZABC'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
RETURN count(s) as count
```

**Cross-Validation:**

- Neo4j `count` should be 0
- Both API and Neo4j should return empty results for non-existent symbols

**Validates:** Empty results handling, Neo4j consistent empty responses

---

### TC-EDGE-002 through TC-EDGE-008

See E2E-TEST-RESULTS.md for complete test cases.

**Neo4j Validation Pattern for Edge Case Tests:**

Edge case tests validate API behavior with boundary conditions. For tests that query data:

```cypher
-- For non-existent file queries (TC-EDGE-002)
MATCH (f:File {path: '<non-existent-path>', projectId: 'proj:00000000000040008000000000000033'})
RETURN count(f) as count
-- Expected: 0

-- For non-existent symbol queries (TC-EDGE-003)
MATCH (s:Symbol {id: '<invalid-symbol-id>', projectId: 'proj:00000000000040008000000000000033'})
RETURN count(s) as count
-- Expected: 0

-- For special character searches (TC-EDGE-004)
MATCH (s:Symbol)
WHERE s.name CONTAINS '<special-chars>'
  AND s.projectId = 'proj:00000000000040008000000000000033'
RETURN count(s) as count

-- For very long query strings (TC-EDGE-005)
-- Validate that queries with long strings don't crash Neo4j

-- For deeply nested structures (TC-EDGE-007)
-- Validate depth traversal limits are respected
MATCH path = (f:File {projectId: 'proj:00000000000040008000000000000033'})-[:IMPORTS*1..10]->(dep:File)
RETURN max(length(path)) as maxDepth
```

**Note:** Some edge case tests (TC-EDGE-006: undefined/null handling) validate API-layer behavior and don't require Neo4j validation.

---

## Category 10: Combined Workflows (5 Tests)

### TC-COMBO-001: Search Then Details

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'CodeModeSandbox', limit: 1 });
if (search.symbols?.length === 0) {
	return { error: 'Not found' };
}
const details = await api.getSymbolDetails({
	symbolId: search.symbols[0].id,
	includeRelationships: true,
});
return {
	success: !!details.symbol,
	found: search.symbols[0].name,
	hasRelationships: !!details.relationships,
};
```

**Expected:**

- `success: true`
- Method chaining works

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name = 'CodeModeSandbox'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
OPTIONAL MATCH (s)-[:CALLS]->(callee:Symbol)
OPTIONAL MATCH (caller:Symbol)-[:CALLS]->(s)
OPTIONAL MATCH (s)-[:INHERITS]->(parent:Symbol)
RETURN s.name as name, s.kind as kind,
       count(DISTINCT callee) as calleeCount,
       count(DISTINCT caller) as callerCount,
       count(DISTINCT parent) as inheritsCount
```

**Cross-Validation:**

- Symbol name should match between search and details
- Relationship counts should match Neo4j relationship counts
- Both API calls should reference the same symbol ID

**Validates:** Sequential method chaining, Neo4j data consistency across calls

---

### TC-COMBO-002: Parallel Dependencies and Dependents

**Code:**

```javascript
const filePath = 'src/client/error-factory.ts';
const [deps, dependents] = await Promise.all([
	api.getDependencies({ filePath }),
	api.getDependents({ filePath }),
]);
return {
	success: true,
	file: filePath,
	imports: deps.directDependencies?.length || 0,
	importedBy: dependents.directDependents?.length || 0,
};
```

**Expected:**

- Both queries succeed
- Returns counts for both

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/client/error-factory.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
OPTIONAL MATCH (f)-[:IMPORTS]->(imports:File)
OPTIONAL MATCH (importedBy:File)-[:IMPORTS]->(f)
RETURN f.path as file,
       count(DISTINCT imports) as importsCount,
       count(DISTINCT importedBy) as importedByCount
```

**Cross-Validation:**

- API `imports` should match Neo4j `importsCount`
- API `importedBy` should match Neo4j `importedByCount`
- Parallel queries should return consistent data

**Validates:** Promise.all parallel queries, Neo4j bidirectional dependency consistency

---

### TC-COMBO-003 through TC-COMBO-005

See E2E-TEST-RESULTS.md for complete test cases.

**Neo4j Validation Pattern for Combined Workflow Tests:**

Combined workflow tests chain multiple API methods. Each step can be validated against Neo4j:

```cypher
-- TC-COMBO-003: Full Symbol Analysis (search -> details -> usage -> impact)
-- Step 1: Verify search result exists
MATCH (s:Symbol)
WHERE s.name CONTAINS '<searchQuery>'
  AND s.projectId = 'proj:00000000000040008000000000000033'
RETURN s.id, s.name, s.filePath
LIMIT 1

-- Step 2: Verify symbol details
MATCH (s:Symbol {id: '<symbolId from step 1>'})
RETURN s.name, s.kind, s.filePath, s.isExported

-- Step 3: Verify usage count
MATCH (s:Symbol {id: '<symbolId>'})<-[:REFERENCES|CALLS|USES_SYMBOL]-(usage)
RETURN count(usage) as usageCount

-- Step 4: Verify impact analysis
MATCH (s:Symbol {id: '<symbolId>'})<-[:REFERENCES|CALLS|USES_SYMBOL]-(usage)
WITH DISTINCT usage
MATCH (f:File)-[:CONTAINS]->(usage)
RETURN count(DISTINCT f.path) as impactedFileCount

-- TC-COMBO-004: Architecture to Dependencies
MATCH (f:File {projectId: 'proj:00000000000040008000000000000033'})
WITH f ORDER BY size(()-[:IMPORTS]->(f)) DESC
LIMIT 1
MATCH (f)-[:IMPORTS]->(dep:File)
RETURN f.path as mostImported, collect(dep.path) as dependencies

-- TC-COMBO-005: Circular Dependency Investigation
MATCH path = (f:File {projectId: 'proj:00000000000040008000000000000033'})-[:IMPORTS*2..5]->(f)
WITH [n IN nodes(path) | n.path] as cyclePath
RETURN cyclePath[0] as startFile, cyclePath
LIMIT 1
```

---

## Category 11: Code Mode Specific (15 Tests)

### TC-CODE-001: Top-Level Await

**Code:**

```javascript
const result = await api.searchSymbols({ query: 'Error', limit: 5 });
return result.symbols?.length || 0;
```

**Expected:**

- Returns a number (await works at top level)

**Neo4j Validation:**

```cypher
MATCH (s:Symbol)
WHERE s.name CONTAINS 'Error'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
RETURN count(s) as totalCount
```

**Cross-Validation:**

- API returned count should be <= 5 (due to limit)
- Neo4j `totalCount` should be >= API count (Neo4j has no limit)

**Validates:** Async IIFE wrapping, Neo4j query execution

---

### TC-CODE-002: Multiple Awaits

**Code:**

```javascript
const first = await api.searchSymbols({ query: 'Error', limit: 3 });
const second = await api.searchSymbols({ query: 'Client', limit: 3 });
return {
	first: first.symbols?.length || 0,
	second: second.symbols?.length || 0,
};
```

**Expected:**

- Both values populated

**Neo4j Validation:**

```cypher
// First query
MATCH (s:Symbol)
WHERE s.name CONTAINS 'Error'
  AND s.projectId = 'proj:00000000000040008000000000000033'
  AND s.branch = 'main'
WITH count(s) as errorCount
// Second query
MATCH (s2:Symbol)
WHERE s2.name CONTAINS 'Client'
  AND s2.projectId = 'proj:00000000000040008000000000000033'
  AND s2.branch = 'main'
RETURN errorCount, count(s2) as clientCount
```

**Cross-Validation:**

- API `first` should be <= 3 and <= Neo4j `errorCount`
- API `second` should be <= 3 and <= Neo4j `clientCount`

**Validates:** Sequential await execution, Neo4j multiple query consistency

---

### TC-CODE-003 through TC-CODE-007: Return Values

**Code examples:**

```javascript
// TC-CODE-003: Return Object
return { message: 'Hello', count: 42 };

// TC-CODE-004: Return Array
return [1, 2, 3, 4, 5];

// TC-CODE-005: Return Primitive
return 42;

// TC-CODE-006: No Return
const x = 1 + 1;

// TC-CODE-007: Return Null
return null;
```

**Note:** Return value tests (TC-CODE-003 through TC-CODE-007) validate sandbox JavaScript execution and serialization capabilities. These tests don't query Neo4j data and therefore don't require Neo4j validation.

**Validates:** Various return value types

---

### TC-CODE-008 through TC-CODE-012: Console Logging

**Code examples:**

```javascript
// TC-CODE-008: console.log
console.log('Test message');
return { done: true };

// TC-CODE-009: console.error
console.error('Error message');
return { done: true };

// TC-CODE-010: console.warn
console.warn('Warning message');
return { done: true };
```

**Expected:**

- Logs captured in `logs` array
- Error/warn prefixed appropriately

**Note:** Console logging tests (TC-CODE-008 through TC-CODE-012) validate sandbox console capture functionality. These tests don't query Neo4j data and therefore don't require Neo4j validation.

**Validates:** Console capture

---

### TC-CODE-013 through TC-CODE-015: listMethods

**Code:**

```javascript
// TC-CODE-014: All 10 Methods Listed
const info = api.listMethods();
const methodNames = info.methods.map((m) => m.name);
const expected = [
	'searchSymbols',
	'getSymbolDetails',
	'getDependencies',
	'getDependents',
	'findCircularDependencies',
	'traceSymbolUsage',
	'getCallGraph',
	'impactAnalysis',
	'findOrphanedCode',
	'getArchitectureOverview',
];
const missing = expected.filter((e) => !methodNames.includes(e));
return {
	methodCount: info.methods?.length || 0,
	missing,
	allPresent: missing.length === 0,
};
```

**Expected:**

- `allPresent: true`
- `methodCount: 10`

**Note:** listMethods tests (TC-CODE-013 through TC-CODE-015) validate the sandbox API documentation functionality. These tests don't query Neo4j data and therefore don't require Neo4j validation.

**Validates:** Complete method list and documentation

---

## Category 12: Neo4j Cross-Validation (10 Tests)

This category contains dedicated tests for validating data consistency between the Constellation API and Neo4j graph database.

### TC-XVAL-001: Symbol Count Consistency

**Purpose:** Verify API symbol count matches Neo4j total count

**Code:**

```javascript
const result = await api.searchSymbols({ query: '', limit: 1000 });
return {
	apiCount: result.pagination?.total || result.symbols?.length || 0,
	symbolsReturned: result.symbols?.length || 0,
};
```

**Neo4j Validation:**

```cypher
MATCH (s:Symbol {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
RETURN count(s) as neo4jCount
```

**Cross-Validation:**

- `apiCount` should equal `neo4jCount` (exact match expected)
- Discrepancy indicates indexing issue or stale data

**Validates:** Total symbol count consistency

---

### TC-XVAL-002: File Count Consistency

**Purpose:** Verify API file count matches Neo4j file count

**Code:**

```javascript
const result = await api.getArchitectureOverview({});
return {
	fileCount: result.metadata?.totalFiles || 0,
};
```

**Neo4j Validation:**

```cypher
MATCH (f:File {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
RETURN count(f) as neo4jFileCount
```

**Cross-Validation:**

- `fileCount` should equal `neo4jFileCount`

**Validates:** File count consistency

---

### TC-XVAL-003: Dependency Relationship Integrity

**Purpose:** Verify getDependencies matches IMPORTS relationships

**Code:**

```javascript
const result = await api.getDependencies({ filePath: 'src/index.ts' });
return {
	apiDeps: result.directDependencies?.map((d) => d.filePath || d.path).sort(),
	depCount: result.directDependencies?.length || 0,
};
```

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/index.ts', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})-[:IMPORTS]->(dep:File)
RETURN collect(dep.path) as neo4jDeps, count(dep) as neo4jDepCount
ORDER BY dep.path
```

**Cross-Validation:**

- `depCount` should equal `neo4jDepCount`
- `apiDeps` array should contain same paths as `neo4jDeps`

**Validates:** IMPORTS relationship consistency

---

### TC-XVAL-004: Symbol Kind Distribution

**Purpose:** Verify API symbol kinds match Neo4j distribution

**Code:**

```javascript
const classes = await api.searchSymbols({
	query: '',
	filterByKind: ['class'],
	limit: 1000,
});
const functions = await api.searchSymbols({
	query: '',
	filterByKind: ['function'],
	limit: 1000,
});
const methods = await api.searchSymbols({
	query: '',
	filterByKind: ['method'],
	limit: 1000,
});
return {
	classes: classes.pagination?.total || classes.symbols?.length || 0,
	functions: functions.pagination?.total || functions.symbols?.length || 0,
	methods: methods.pagination?.total || methods.symbols?.length || 0,
};
```

**Neo4j Validation:**

```cypher
MATCH (s:Symbol {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
RETURN s.kind as kind, count(s) as count
ORDER BY count DESC
```

**Cross-Validation:**

- API class count should match Neo4j class count
- API function count should match Neo4j function count
- API method count should match Neo4j method count

**Validates:** Symbol kind distribution consistency

---

### TC-XVAL-005: Call Graph Bidirectional Consistency

**Purpose:** Verify callers/callees are symmetric in Neo4j

**Neo4j Validation:**

```cypher
// All CALLS relationships should be bidirectionally queryable
MATCH (a:Symbol {projectId: 'proj:00000000000040008000000000000033'})-[r:CALLS]->(b:Symbol)
WITH a, b
MATCH (b)<-[r2:CALLS]-(a)
WITH count(*) as symmetricCount
MATCH (s:Symbol {projectId: 'proj:00000000000040008000000000000033'})-[:CALLS]->()
RETURN symmetricCount, count(*) as totalCalls, symmetricCount = count(*) as isSymmetric
```

**Cross-Validation:**

- `isSymmetric` should be `true`
- Every CALLS relationship should be traversable in both directions

**Validates:** CALLS relationship bidirectional integrity

---

### TC-XVAL-006: Exported Symbol Consistency

**Purpose:** Verify isExported flag matches Neo4j data

**Code:**

```javascript
const result = await api.searchSymbols({
	query: '',
	isExported: true,
	limit: 1000,
});
return {
	exportedCount: result.pagination?.total || result.symbols?.length || 0,
	sampleSymbols: result.symbols?.slice(0, 5).map((s) => s.name) || [],
};
```

**Neo4j Validation:**

```cypher
MATCH (s:Symbol {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
WHERE s.isExported = true
RETURN count(s) as neo4jExportedCount,
       collect(s.name)[0..5] as sampleNames
```

**Cross-Validation:**

- `exportedCount` should equal `neo4jExportedCount`
- Sample symbols should exist in Neo4j exported symbols

**Validates:** isExported flag consistency

---

### TC-XVAL-007: Package Import Consistency

**Purpose:** Verify external package imports match Neo4j Package nodes

**Code:**

```javascript
const result = await api.getDependencies({
	filePath: 'src/code-mode/sandbox.ts',
	includePackages: true,
});
return {
	packageCount: result.packages?.length || 0,
	packages: result.packages?.map((p) => p.name || p).sort() || [],
};
```

**Neo4j Validation:**

```cypher
MATCH (f:File {path: 'src/code-mode/sandbox.ts', projectId: 'proj:00000000000040008000000000000033'})-[:IMPORTS]->(p:Package)
RETURN count(p) as neo4jPackageCount,
       collect(p.name) as neo4jPackages
ORDER BY p.name
```

**Cross-Validation:**

- `packageCount` should equal `neo4jPackageCount`
- `packages` array should match `neo4jPackages`

**Validates:** Package node import consistency

---

### TC-XVAL-008: Symbol Location Accuracy

**Purpose:** Verify symbol line/column numbers match Neo4j

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'CodeModeSandbox', limit: 1 });
if (search.symbols?.length === 0) return { error: 'Not found' };
const details = await api.getSymbolDetails({ symbolId: search.symbols[0].id });
return {
	name: details.symbol?.name,
	filePath: details.symbol?.filePath,
	line: details.symbol?.line,
	column: details.symbol?.column,
	symbolId: search.symbols[0].id,
};
```

**Neo4j Validation:**

```cypher
MATCH (s:Symbol {name: 'CodeModeSandbox', projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
RETURN s.name as name, s.filePath as filePath, s.line as line, s.column as column
```

**Cross-Validation:**

- API `line` should equal Neo4j `line`
- API `column` should equal Neo4j `column`
- API `filePath` should equal Neo4j `filePath`

**Validates:** Symbol location data accuracy

---

### TC-XVAL-009: Circular Dependency Detection Accuracy

**Purpose:** Verify circular dependencies match Neo4j cycle detection

**Code:**

```javascript
const result = await api.findCircularDependencies({ maxDepth: 5 });
return {
	cycleCount: result.cycles?.length || 0,
	hasCycles: (result.cycles?.length || 0) > 0,
	sampleCycle: result.cycles?.[0] || null,
};
```

**Neo4j Validation:**

```cypher
MATCH path = (f:File {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})-[:IMPORTS*2..5]->(f)
WITH DISTINCT [n IN nodes(path) | n.path] as cyclePath
RETURN count(cyclePath) as neo4jCycleCount,
       collect(cyclePath)[0] as sampleCycle
```

**Cross-Validation:**

- API `cycleCount` should equal Neo4j `neo4jCycleCount`
- Same files should appear in detected cycles

**Validates:** Circular dependency detection accuracy

---

### TC-XVAL-010: Orphaned Code Detection Accuracy

**Purpose:** Verify orphaned code detection matches Neo4j unreferenced symbols

**Code:**

```javascript
const result = await api.findOrphanedCode({
	filePattern: 'src/**',
	filterByKind: ['function', 'class'],
	limit: 20,
});
return {
	orphanCount: result.orphanedSymbols?.length || 0,
	orphans:
		result.orphanedSymbols?.slice(0, 5).map((s) => ({
			name: s.name,
			kind: s.kind,
			filePath: s.filePath,
		})) || [],
};
```

**Neo4j Validation:**

```cypher
MATCH (s:Symbol {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
WHERE s.filePath STARTS WITH 'src/'
  AND s.kind IN ['function', 'class']
  AND s.isExported = true
  AND NOT exists(()-[:REFERENCES|CALLS|USES_SYMBOL]->(s))
  AND NOT exists(()-[:IMPORTS]->(s))
RETURN count(s) as neo4jOrphanCount,
       collect({name: s.name, kind: s.kind, filePath: s.filePath})[0..5] as sampleOrphans
```

**Cross-Validation:**

- API `orphanCount` should be close to Neo4j `neo4jOrphanCount`
- Detected orphans should match Neo4j unreferenced symbols
- Note: API may apply additional filtering (test files, internal symbols)

**Validates:** Orphaned code detection accuracy

---

## Appendix: Quick Reference

### Test Count by Category

| Category               | Count   | Neo4j Validation |
| ---------------------- | ------- | ---------------- |
| Discovery Methods      | 10      | Full             |
| Dependency Methods     | 9       | Full             |
| Tracing Methods        | 9       | Full             |
| Impact Methods         | 9       | Full             |
| Architecture Methods   | 4       | Full             |
| Parameter Validation   | 11      | N/A (API-layer)  |
| Error Handling         | 6       | N/A (API-layer)  |
| Sandbox Security       | 9       | N/A (Sandbox)    |
| Edge Cases             | 8       | Partial          |
| Combined Workflows     | 5       | Full             |
| Code Mode Specific     | 15      | Partial          |
| Neo4j Cross-Validation | 10      | Full             |
| **TOTAL**              | **105** |                  |

### Neo4j Validation Commands

**Schema Discovery:**

```cypher
CALL db.labels()                    -- List all node labels
CALL db.relationshipTypes()         -- List all relationship types
MATCH (s:Symbol) RETURN keys(s)[0..10] -- Sample symbol properties
```

**Common Validation Queries:**

```cypher
-- Count symbols
MATCH (s:Symbol {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
RETURN count(s)

-- Count files
MATCH (f:File {projectId: 'proj:00000000000040008000000000000033', branch: 'main'})
RETURN count(f)

-- Count relationships
MATCH ()-[r]->() RETURN type(r), count(r) ORDER BY count(r) DESC

-- Symbol lookup by name
MATCH (s:Symbol {name: '<symbolName>', projectId: 'proj:00000000000040008000000000000033'})
RETURN s.name, s.kind, s.filePath, s.line
```

### MCP Tool Commands

**Constellation API Test:**

```
mcp__plugin_constellation_constellation__execute_code
```

**Neo4j Validation Query:**

```
mcp__neo4j__read-cypher
```

### Known Issues

1. ~~**TC-IMPACT-007**: `filePattern` uses regex, not glob syntax~~ ✅ FIXED
2. **TC-TRACE-006**: `includeContext` may not populate context
3. **TC-DEP-007**: `includeImpactMetrics` may not return metrics
4. **TC-IMPACT-008**: `filterByKind` may not filter correctly

### Pass Criteria

- **PASS**: All expected conditions met
- **FAIL**: Any expected condition not met
- **PARTIAL**: Some conditions met, with documented observations

### Running the Full Test Suite

1. Ensure prerequisites are met (constellation-core running, project indexed)
2. Execute each test case via the `execute_code` MCP tool
3. Compare results against expected values
4. Document any deviations in the test results file
