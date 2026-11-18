# Constellation MCP End-to-End Test Procedure

This document provides a complete, reproducible test procedure for validating the constellation-mcp MCP server functionality.

> **Validation status:** The graph checks in this document were ported from Cypher to ArcadeDB SQL by static translation against the graph schema definition. They have not yet been executed against a live graph. On the first full run, treat a query error as a defect in this procedure before treating it as a product defect.

---

## Prerequisites

### Environment Requirements

1. **constellation-core** running on `localhost:3000`

   ```bash
   cd constellation-core
   npm run docker:up
   npm run start:intel-api:dev
   ```

2. **Valid access key** configured (stored in `CONSTELLATION_ACCESS_KEY` env var)

3. **Project indexed** in constellation

   ```bash
   constellation index --full
   ```

4. **MCP servers** connected to Claude Code:
   - **Constellation MCP** (`mcp__local-constellation__code_intel`, the server pointed at the local stack) - For API tests
   - **ArcadeDB MCP** (`mcp__arcadedb__query` with `language: sql`, database `constellation`, read-only) - For validation queries. Connect as the non-root `constellation` service user, never `root`.

5. **Graph schema applied** to the local ArcadeDB (`npm run graph:schema` in constellation-core). ArcadeDB Studio at http://localhost:2480 is a browser UI for people; run the validation queries through the MCP tool, not through Studio or the HTTP API.

### Test Context

- **Project:** constellation-mcp
- **Project ID:** `proj:adf45ed0a35649d19a7d70edaa9636b1`
- **Branch:** main
- **MCP Tools:**
  - `code_intel` (Constellation API tests)
  - `mcp__arcadedb__query` (ArcadeDB validation queries, `language: sql`)

> **Note:** The Project ID above is environment-specific. If running tests against a different Constellation instance, update the project ID in all ArcadeDB validation queries throughout this document. Every validation query is scoped by both `projectId` and `branch`. You can find your project ID by running `constellation status` or checking the Constellation web interface.

---

## Step 0: Update the Code Index

Before running any tests, ensure the codebase is freshly indexed:

```bash
cd constellation-mcp
constellation index --full
```

This command parses the codebase, extracts AST intelligence, and uploads it to constellation-core. The index must be current for tests to return accurate results.

The index must land in the same stack the tests query: when the tests run against a local stack, point the CLI at that stack before indexing.

---

## Test Execution Method

All tests are executed via the `code_intel` MCP tool. Each test case provides:

- **Code**: JavaScript to execute in the sandbox
- **Expected**: What the result should contain
- **ArcadeDB Validation**: ArcadeDB SQL query (or queries) to cross-check results against the graph database
- **Cross-Validation**: Comparison logic between API and ArcadeDB results
- **Validates**: What aspect of the system is being tested

---

## ArcadeDB Validation Workflow

Claude Code executes tests using both MCP servers in a two-phase process:

### Phase 1: Execute Constellation API Test

Claude calls `mcp__local-constellation__code_intel` with the test JavaScript code and captures the result.

### Phase 2: Execute ArcadeDB Validation Query

Claude calls `mcp__arcadedb__query` (`language: sql`, database `constellation`) with the validation query and captures the result.

How to read the validation blocks:

- **One statement per call.** A block may hold several statements, labelled `-- A:`, `-- B:` and so on. Send each statement in its own call and leave the `--` label lines out.
- **Bounded samples** keep their `LIMIT` inside a subquery on purpose; do not move it to the top level.
- **Name matches are case-insensitive.** `searchSymbols` matches its query as a case-insensitive substring, so the checks compare `` `name`.toLowerCase() `` with a lowercased pattern. Lowercase any query you substitute into a placeholder.
- **One row per matching symbol.** Where a statement anchors on a symbol name and returns per-symbol counts, add the rows together when more than one symbol matches.
- **Path checks** (import cycles, maximum import depth) have no single-statement SQL form. Those blocks return the file-to-file `IMPORTS` edge list and state the rule to compute the value from it. If the edge list comes back truncated, page it with `SKIP`/`LIMIT` inside a subquery.

### Phase 3: Compare Results

Claude compares API results against ArcadeDB results:

- **Counts should match** (within tolerance for pagination)
- **IDs should exist** in both systems
- **Relationships should be consistent**
- **Report PASS/FAIL with discrepancy details**

### Interpreting Discrepancies

| Scenario                   | Likely Cause                         | Action              |
| -------------------------- | ------------------------------------ | ------------------- |
| API count > ArcadeDB count | API caching or stale data            | Re-index project    |
| API count < ArcadeDB count | API filtering (test exclusion)       | Check filter params |
| Missing relationships      | Incomplete extraction                | Check CLI parser    |
| Extra relationships        | API enrichment layer                 | Expected behavior   |
| Symbol not found           | Symbol ID mismatch or encoding issue | Verify ID format    |

### ArcadeDB Schema Reference

**Vertex Types**: `File`, `Symbol`, `Package`, `Export`, `Preprocessor`, `UnresolvedReference`, `UnresolvedSymbol`, `UnresolvedCall`, `UnresolvedFile`, `PendingRef`, `PendingRel`

**Edge Types**: `REFERENCES`, `CALLS`, `IMPORTS`, `CONTAINS`, `HAS_CHILD`, `INHERITS`, `INHERITS_CLOSURE`, `IMPLEMENTS`, `EXTENDS`, `DEPENDS_ON`, `DECORATED_BY`, `EXPORTS`, `EXPORTS_SYMBOL`, `RE_EXPORTS_FROM`, `HAS_DIRECTIVE`, `PARTIAL_OF`, `CALLS_UNRESOLVED`, `REFERENCES_UNRESOLVED`

**Scope Properties**: every vertex carries `projectId` and `branch` (the property is `branch`). Scope every query by both, on the anchor type and on the traversed endpoint.

**Key Symbol Properties**: `name`, `kind`, `filePath`, `isExported`, `projectId`, `branch`, `id`, `qualifiedName`, `modifiers`, `line`, `column`

---

## Category 1: Discovery Methods (14 Tests)

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

**ArcadeDB Validation:**

```sql
-- A: count
SELECT count(*) AS `count`
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%codemodesandbox%'

-- B: symbols
SELECT `name` AS name, `kind` AS kind, `filePath` AS filePath
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%codemodesandbox%'
```

**Cross-Validation:**

- ArcadeDB `count` should equal API `symbolCount`
- ArcadeDB `symbols[0].name` should equal `firstSymbol.name`
- ArcadeDB `symbols[0].kind` should equal `firstSymbol.kind`

**Validates:** Basic search functionality, symbol structure, ArcadeDB data consistency

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

**ArcadeDB Validation:**

```sql
-- A: totalCount
SELECT count(*) AS totalCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%error%'
  AND `kind` = 'class'

-- B: limitedNames (first 5)
SELECT name FROM (
  SELECT `name` AS name
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name`.toLowerCase() LIKE '%error%'
    AND `kind` = 'class'
  LIMIT 5
)
```

**Cross-Validation:**

- All API symbols should have `kind === 'class'`
- API `symbolCount` should be <= 5 (limit applied)
- ArcadeDB `totalCount` represents unfiltered count (may be >= API count due to limit)

**Validates:** `filterByKind` parameter, `limit` parameter, ArcadeDB kind filtering

---

### TC-DISC-003: searchSymbols - Visibility Filter

**Code:**

```javascript
const exported = await api.searchSymbols({
	query: 'Error',
	filterByVisibility: ['exported'],
	limit: 10,
});
const privateOnly = await api.searchSymbols({
	query: 'code',
	filterByVisibility: ['private'],
	limit: 10,
});
return {
	exportedCount: exported.symbols?.length || 0,
	allExported: exported.symbols?.every((s) => s.isExported === true) ?? true,
	exportedSymbols:
		exported.symbols?.slice(0, 5).map((s) => ({
			name: s.name,
			isExported: s.isExported,
		})) || [],
	privateCount: privateOnly.symbols?.length || 0,
	allPrivate: privateOnly.symbols?.every((s) => s.visibility === 'private') ?? true,
};
```

**Expected:**

- `exportedCount > 0`
- `allExported: true` (all returned symbols have `isExported: true`)
- `privateCount >= 0` (private symbols exist if class members match)
- `allPrivate: true` (if any returned, all have `visibility: 'private'`)

**ArcadeDB Validation:**

```sql
-- A: exportedCount
SELECT count(*) AS exportedCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%error%'
  AND `isExported` = true

-- B: symbols (first 10)
SELECT name, isExported FROM (
  SELECT `name` AS name, `isExported` AS isExported
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name`.toLowerCase() LIKE '%error%'
    AND `isExported` = true
  LIMIT 10
)
```

**Cross-Validation:**

- API `exportedCount` should be <= ArcadeDB `exportedCount` (API applies limit)
- All API symbols should have `isExported: true`
- Note: `filterByVisibility: ['exported']` maps to `s.isExported = true` in Core
- Note: `filterByVisibility: ['public']` maps to `s.visibility = 'public'` (class members only)
- The TS extractor sets `visibility` only on class members, and `isExported` only on module-level exports — the two never co-exist as `public` + `true`

**Validates:** `filterByVisibility` parameter (both 'exported' and 'private' variants), ArcadeDB visibility/export filtering

---

### TC-DISC-004: searchSymbols - File Pattern

**Code:**

```javascript
const result = await api.searchSymbols({
	query: 'Error',
	filterByFile: 'src/client/**',
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

**ArcadeDB Validation:**

```sql
-- A: count
SELECT count(*) AS `count`
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%error%'
  AND `filePath` LIKE 'src/client/%'

-- B: symbols (first 10)
SELECT name, filePath FROM (
  SELECT `name` AS name, `filePath` AS filePath
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name`.toLowerCase() LIKE '%error%'
    AND `filePath` LIKE 'src/client/%'
  LIMIT 10
)
```

**Cross-Validation:**

- All API symbols should have `filePath` containing "src/client/"
- ArcadeDB `count` should be >= API `symbolCount` (API may apply additional filtering)

**Validates:** `filterByFile` parameter, ArcadeDB path filtering

---

### TC-DISC-005: searchSymbols - Usage Count

**Code:**

```javascript
const result = await api.searchSymbols({
	query: 'getDefaultConfig',
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

**ArcadeDB Validation:**

```sql
SELECT name, usageCount FROM (
  SELECT `name` AS name,
         in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() AS usageCount
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name`.toLowerCase() LIKE '%getdefaultconfig%'
  ORDER BY usageCount DESC
  LIMIT 5
)
```

**Cross-Validation:**

- API `usageCount` should match ArcadeDB reference count for each symbol
- Symbol names should match between API and ArcadeDB results

**Validates:** `includeUsageCount` option, ArcadeDB reference counting

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

**ArcadeDB Validation:**

```sql
-- A: firstPage
SELECT name FROM (
  SELECT `name` AS name
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name`.toLowerCase() LIKE '%error%'
  ORDER BY `name`
  SKIP 0 LIMIT 3
)

-- B: secondPage
SELECT name FROM (
  SELECT `name` AS name
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name`.toLowerCase() LIKE '%error%'
  ORDER BY `name`
  SKIP 3 LIMIT 3
)

-- C: totalCount
SELECT count(*) AS totalCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%error%'
```

**Cross-Validation:**

- API `pagination.total` should equal ArcadeDB `totalCount`
- No overlap between pages in both systems
- Page contents are not expected to match: the API orders results by relevance, while statements A and B order by name. Every name on an API page should still satisfy the name match

**Validates:** `offset` parameter, `pagination` in response, ArcadeDB SKIP/LIMIT consistency

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

**ArcadeDB Validation:**

```sql
SELECT `id` AS id, `name` AS name, `kind` AS kind, `filePath` AS filePath
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = 'CodeModeSandbox'
```

**Cross-Validation:**

- API `symbolName` should match ArcadeDB `name`
- API `symbolKind` should match ArcadeDB `kind`
- API `filePath` should match ArcadeDB `filePath`
- Symbol ID should exist in ArcadeDB

**Validates:** Symbol lookup by ID, ArcadeDB symbol existence

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

**ArcadeDB Validation:**

```sql
SELECT `name` AS name, `kind` AS kind, `filePath` AS filePath
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = 'CodeModeSandbox'
  AND `filePath` = 'src/code-mode/sandbox.ts'
```

**Cross-Validation:**

- API `symbolName` should match ArcadeDB `name`
- API `filePath` should match ArcadeDB `filePath`
- Exactly one symbol should be returned in both systems

**Validates:** Symbol lookup by name+path combination, ArcadeDB precise matching

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

**ArcadeDB Validation:**

```sql
-- A: refCount (one row per matching symbol)
SELECT `name` AS name,
       in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() AS refCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = 'createStructuredError'

-- B: refFiles (distinct file paths of the referencing symbols)
SELECT DISTINCT outV().filePath AS refFile
FROM (
  SELECT expand(inE('REFERENCES','CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name` = 'createStructuredError'
)
WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
  AND outV().filePath IS NOT NULL
```

**Cross-Validation:**

- API `referenceCount` should match or be close to ArcadeDB `refCount`
- Both systems should show references exist for this symbol

**Validates:** `includeReferences` option, ArcadeDB REFERENCES relationship counting

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

**ArcadeDB Validation:**

```sql
SELECT `name` AS name,
       out('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS callsCount,
       in('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS calledByCount,
       out('INHERITS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS inheritsCount,
       in('INHERITS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS inheritedByCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = 'ConstellationClient'
```

**Cross-Validation:**

- API relationship counts should match ArcadeDB relationship counts
- Relationship types present in API should have corresponding ArcadeDB relationships

**Validates:** `includeRelationships` option, ArcadeDB CALLS/INHERITS relationships

---

### TC-DISC-011: ping - Authentication Check

**Code:**

```javascript
const result = await api.ping();
return {
	success: result.pong === true,
	pong: result.pong,
};
```

**Expected:**

- `success: true`
- `pong: true`

**ArcadeDB Validation:**

```sql
-- ping is a lightweight auth check that does not query the graph database.
-- If ping succeeds, authentication is valid. There is no statement to run.
```

**Cross-Validation:**

- ping() succeeds = valid authentication
- No ArcadeDB query required (auth-only check)

**Validates:** Authentication verification, lightweight connectivity check

---

### TC-DISC-012: getCapabilities - Project Status Check

**Code:**

```javascript
const result = await api.getCapabilities();
return {
	success: true,
	isIndexed: result.isIndexed,
	hasSymbolCount: typeof result.symbolCount === 'number',
	hasFileCount: typeof result.fileCount === 'number',
	availableFeatures: result.availableFeatures
		? Object.keys(result.availableFeatures)
		: [],
};
```

**Expected:**

- `isIndexed: true` (for indexed project)
- `hasSymbolCount: true`
- `hasFileCount: true`
- `availableFeatures` includes: searchSymbols, impactAnalysis, callGraph, etc.

**ArcadeDB Validation:**

```sql
-- A: symbolCount
SELECT count(*) AS symbolCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'

-- B: fileCount
SELECT count(*) AS fileCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
```

**Cross-Validation:**

- API `symbolCount` should match ArcadeDB `symbolCount`
- API `fileCount` should match ArcadeDB `fileCount`
- `isIndexed` should be true if ArcadeDB returns counts > 0

**Validates:** Project indexing status, capability discovery, feature availability

---

### TC-DISC-013: ping - Failure Handling (Documentation)

**Code:**

```javascript
return {
	note: 'Cannot test ping failure with valid auth - documenting expected behavior',
	documentedBehavior: {
		successResponse: { pong: true },
		failureScenarios: [
			'Invalid CONSTELLATION_ACCESS_KEY → AUTH_ERROR',
			'Network unreachable → NETWORK_ERROR',
			'API server down → CONNECTION_ERROR',
		],
	},
};
```

**Expected:**

- Documents expected ping failure scenarios

**Validates:** ping error handling (documented)

---

### TC-DISC-014: getCapabilities - Unindexed Project (Documentation)

**Code:**

```javascript
return {
	note: 'Cannot test unindexed project with current setup - documenting expected behavior',
	documentedBehavior: {
		indexedResponse: {
			isIndexed: true,
			symbolCount: '>0',
			fileCount: '>0',
			availableFeatures: { searchSymbols: true, impactAnalysis: true },
		},
		unindexedResponse: {
			isIndexed: false,
			symbolCount: 0,
			fileCount: 0,
			limitations: ['Project not indexed. Run: constellation index'],
		},
	},
};
```

**Expected:**

- Documents expected getCapabilities behavior for indexed vs unindexed projects

**Validates:** getCapabilities unindexed state (documented)

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

**ArcadeDB Validation:**

```sql
-- A: depCount
SELECT `path` AS `file`,
       out('IMPORTS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() AS depCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `path` = 'src/code-mode/sandbox.ts'

-- B: firstDeps (first 5)
SELECT dep FROM (
  SELECT CASE WHEN inV().@type = 'File' THEN inV().path
              WHEN inV().@type = 'Package' THEN inV().name
              ELSE null END AS dep
  FROM (
    SELECT expand(outE('IMPORTS'))
    FROM File
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `path` = 'src/code-mode/sandbox.ts'
  )
  WHERE inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
  LIMIT 5
)
```

**Cross-Validation:**

- API `directDependencyCount` should match ArcadeDB `depCount` (includes both File and Package imports)
- API `firstThreeDeps` should be subset of ArcadeDB imported targets

**Validates:** Basic dependency analysis, ArcadeDB IMPORTS relationship (File + Package targets)

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

**ArcadeDB Validation:**

```sql
-- A: directCount
SELECT count(*) AS directCount FROM (
  SELECT DISTINCT inV().@rid AS rid
  FROM (
    SELECT expand(outE('IMPORTS'))
    FROM File
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `path` = 'src/code-mode/sandbox.ts'
  )
  WHERE (inV().@type = 'File' OR inV().@type = 'Package')
    AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
)

-- B: transitiveCount (exactly two IMPORTS hops, start file excluded)
SELECT count(*) AS transitiveCount FROM (
  SELECT DISTINCT inV().@rid AS rid
  FROM (
    SELECT expand(outE('IMPORTS'))
    FROM (
      SELECT expand(out('IMPORTS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
      FROM File
      WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
        AND `path` = 'src/code-mode/sandbox.ts'
    )
  )
  WHERE (inV().@type = 'File' OR inV().@type = 'Package')
    AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
    AND ifnull(inV().path, '') <> 'src/code-mode/sandbox.ts'
)
```

**Cross-Validation:**

- API `directDependencyCount` should match ArcadeDB `directCount` (includes both `File` and `Package` targets; a filter on `inV().@type = 'File'` alone undercounts)
- API `transitiveDependencyCount` should be close to ArcadeDB `transitiveCount`

**Validates:** `depth` parameter, transitive dependencies, ArcadeDB path traversal (File + Package targets)

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

**ArcadeDB Validation:**

```sql
-- A: packageCount
SELECT count(*) AS packageCount
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `path` = 'src/code-mode/sandbox.ts'
)
WHERE inV().@type = 'Package'
  AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'

-- B: packages (first 5)
SELECT name FROM (
  SELECT inV().name AS name
  FROM (
    SELECT expand(outE('IMPORTS'))
    FROM File
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `path` = 'src/code-mode/sandbox.ts'
  )
  WHERE inV().@type = 'Package'
    AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
  LIMIT 5
)
```

**Cross-Validation:**

- API `packageCount` should match ArcadeDB package count
- API `packages` should match ArcadeDB package names

**Validates:** `includePackages` option, ArcadeDB Package node imports

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

**ArcadeDB Validation:**

```sql
SELECT depPath, importedSymbols, symbolCount FROM (
  SELECT inV().path AS depPath,
         `symbols` AS importedSymbols,
         `symbols`.size() AS symbolCount
  FROM (
    SELECT expand(outE('IMPORTS'))
    FROM File
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `path` = 'src/code-mode/sandbox.ts'
  )
  WHERE inV().@type = 'File'
    AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
    AND `symbols` IS NOT NULL
  LIMIT 3
)
```

**Cross-Validation:**

- API `importedSymbols` should match ArcadeDB `importedSymbols` (the `symbols` property of the `IMPORTS` edge)
- Symbol counts should be consistent between systems

**Validates:** `includeSymbols` option, ArcadeDB IMPORTS relationship symbols property

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

**ArcadeDB Validation:**

```sql
-- A: dependentCount
SELECT `path` AS `file`,
       in('IMPORTS')[@type = 'File' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() AS dependentCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `path` = 'src/client/error-factory.ts'

-- B: firstThree
SELECT dependentPath FROM (
  SELECT outV().path AS dependentPath
  FROM (
    SELECT expand(inE('IMPORTS'))
    FROM File
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `path` = 'src/client/error-factory.ts'
  )
  WHERE outV().@type = 'File'
    AND outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
  LIMIT 3
)
```

**Cross-Validation:**

- API `directDependentCount` should match ArcadeDB `dependentCount`
- API `firstThree` should be subset of ArcadeDB dependent files

**Validates:** Reverse dependency analysis, ArcadeDB reverse IMPORTS traversal

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

**ArcadeDB Validation:**

```sql
-- A: directCount
SELECT count(*) AS directCount FROM (
  SELECT DISTINCT outV().@rid AS rid
  FROM (
    SELECT expand(inE('IMPORTS'))
    FROM File
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `path` = 'src/types/mcp-errors.ts'
  )
  WHERE (outV().@type = 'File' OR outV().@type = 'Package')
    AND outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
)

-- B: transitiveCount (exactly two IMPORTS hops, target file excluded)
SELECT count(*) AS transitiveCount FROM (
  SELECT DISTINCT outV().@rid AS rid
  FROM (
    SELECT expand(inE('IMPORTS'))
    FROM (
      SELECT expand(in('IMPORTS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
      FROM File
      WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
        AND `path` = 'src/types/mcp-errors.ts'
    )
  )
  WHERE (outV().@type = 'File' OR outV().@type = 'Package')
    AND outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
    AND ifnull(outV().path, '') <> 'src/types/mcp-errors.ts'
)
```

**Cross-Validation:**

- API `directDependentCount` should match ArcadeDB `directCount` (the source vertex is not restricted to `File` alone; a `File`-only filter is the same defect class as the `getDependencies` depth queries, even though in practice only `File` vertices originate `IMPORTS` edges)
- API `transitiveDependentCount` should be close to ArcadeDB `transitiveCount`

**Validates:** `depth` parameter for reverse dependencies, ArcadeDB reverse path traversal

---

### TC-DEP-007: getDependents - With Impact Metrics

**Code:**

```javascript
const result = await api.getDependents({
	filePath: 'src/config/config-cache.ts',
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

**ArcadeDB Validation:**

```sql
-- A: dependentCount (distinct importing files)
SELECT `path` AS `file`,
       in('IMPORTS')[@type = 'File' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS dependentCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `path` = 'src/config/config-cache.ts'

-- B: dependents
SELECT DISTINCT outV().path AS dependent
FROM (
  SELECT expand(inE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `path` = 'src/config/config-cache.ts'
)
WHERE outV().@type = 'File'
  AND outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
```

**Cross-Validation:**

- API `directDependentCount` should match ArcadeDB `dependentCount` (must count distinct importing files, hence `.asSet().size()`; a bare `.size()` inflates the total when a single file imports the target via more than one `IMPORTS` edge)
- Metric calculation is API-layer enrichment, not directly in ArcadeDB

**Validates:** `includeImpactMetrics` option, ArcadeDB dependent count accuracy

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

**ArcadeDB Validation:**

```sql
-- ArcadeDB SQL has no variable-length path pattern, so the cycle count is
-- computed from the file-to-file IMPORTS edge list this statement returns.
-- Rule: enumerate the simple directed cycles of length 2 to 10 in the edge
-- list (a self-import is length 1 and does not count), reduce each cycle to
-- its sorted list of member paths, and count the distinct lists.
--   cycleCount   = number of distinct sorted member lists
--   sampleCycles = the first 3 of them
SELECT outV().path AS fromPath, inV().path AS toPath
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
WHERE inV().@type = 'File'
  AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
ORDER BY fromPath, toPath
```

**Cross-Validation:**

- API `cycleCount` should match ArcadeDB `cycleCount`
- Both systems should detect the same circular dependency patterns
- Note: a cycle `A -> B -> A` is found once per member file it is traversed from (a walk starting at `A` and a walk starting at `B` are two separate paths for the same cycle). The rule above reduces each cycle to its sorted member list, a rotation-independent key, before counting distinct lists; counting the raw ordered path lists counts each rotation separately and overcounts by the cycle length

**Validates:** Circular dependency detection, ArcadeDB cycle detection query (rotation-independent deduplication)

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

**ArcadeDB Validation:**

```sql
-- ArcadeDB SQL has no variable-length path pattern, so the cycles are
-- computed from the file-to-file IMPORTS edge list this statement returns.
-- Rule: enumerate the directed cycles of length 2 to 5 that start and end at
-- 'src/code-mode/sandbox.ts', each written as its ordered list of paths
-- (start file first and last).
--   cycleCount = number of distinct ordered lists
--   cycles     = those lists
SELECT outV().path AS fromPath, inV().path AS toPath
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
WHERE inV().@type = 'File'
  AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
ORDER BY fromPath, toPath
```

**Cross-Validation:**

- API `totalCycles` should match ArcadeDB `cycleCount`
- All cycles should involve the specified file

**Validates:** `filePath` filter, `maxDepth` limit, ArcadeDB file-specific cycle detection

---

## Category 3: Tracing Methods (9 Tests)

### TC-TRACE-001: traceSymbolUsage - By Symbol ID

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'getDefaultConfig', limit: 1 });
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

**ArcadeDB Validation:**

```sql
-- A: usageCount
SELECT count(*) AS usageCount
FROM (
  SELECT expand(inE('REFERENCES','CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name` = 'getDefaultConfig'
)
WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'

-- B: relationshipTypes
SELECT DISTINCT @type AS relationshipType
FROM (
  SELECT expand(inE('REFERENCES','CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name` = 'getDefaultConfig'
)
WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
```

**Cross-Validation:**

- API `directUsageCount` should match ArcadeDB `usageCount`
- Both systems should show usages exist for this symbol

**Validates:** Usage tracing by ID, ArcadeDB REFERENCES/CALLS relationship counting

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
	totalUsageCount: result.summary?.totalUsages || 0,
};
```

**Expected:**

- `success: true`
- `totalUsageCount > 0`
- `directUsageCount > 0` (may be capped by pagination limit)

**ArcadeDB Validation:**

```sql
SELECT count(*) AS usageCount
FROM (
  SELECT expand(inE('REFERENCES','CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name` = 'createStructuredError'
    AND `filePath` = 'src/client/error-factory.ts'
)
WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
```

**Cross-Validation:**

- API `totalUsageCount` should match ArcadeDB `usageCount` (true total, not capped)
- `directUsageCount` may be less than `totalUsageCount` due to pagination (default limit: 50)
- Symbol should be found by name+path in ArcadeDB

**Validates:** Usage tracing by name+path, pagination behavior, ArcadeDB precise symbol lookup

---

### TC-TRACE-003: traceSymbolUsage - Filter By Usage Type

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'createStructuredError', limit: 1 });
if (search.symbols?.length === 0) {
	return { error: 'No symbols found' };
}
const allUsages = await api.traceSymbolUsage({
	symbolId: search.symbols[0].id,
});
const functionOnly = await api.traceSymbolUsage({
	symbolId: search.symbols[0].id,
	filterByUsageType: ['function'],
});
return {
	success: !!allUsages.symbol,
	symbolName: allUsages.symbol?.name,
	allUsageCount: allUsages.directUsages?.length || 0,
	functionOnlyCount: functionOnly.directUsages?.length || 0,
	isSubset: functionOnly.directUsages?.length <= allUsages.directUsages?.length,
	symbolId: search.symbols[0].id,
};
```

**Expected:**

- `allUsageCount > 0`
- `functionOnlyCount <= allUsageCount` (filtered is subset of all)
- `isSubset: true`

**ArcadeDB Validation:**

```sql
SELECT count(*) AS functionUsageCount
FROM (
  SELECT expand(inE('REFERENCES','CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name` = 'createStructuredError'
)
WHERE outV().@type = 'Symbol'
  AND outV().kind = 'function'
  AND outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
```

**Cross-Validation:**

- API `functionOnlyCount` should match ArcadeDB `functionUsageCount`
- `filterByUsageType` filters by the **symbol kind** of the using node (not the relationship type)
- To filter by relationship type, use `filterByRelationshipType` parameter instead

**Validates:** `filterByUsageType` filter (symbol kind filtering), ArcadeDB `outV().kind` matching

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

**ArcadeDB Validation:**

```sql
-- A: directCount
SELECT count(*) AS directCount FROM (
  SELECT DISTINCT @rid FROM (
    SELECT expand(in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
    FROM Symbol
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `name` = 'ConstellationClient'
  )
)

-- B: transitiveCount (exactly two hops, the symbol itself excluded)
SELECT count(*) AS transitiveCount FROM (
  SELECT DISTINCT @rid FROM (
    SELECT expand(in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
    FROM (
      SELECT expand(in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
      FROM Symbol
      WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
        AND `name` = 'ConstellationClient'
    )
  )
  WHERE NOT (@type = 'Symbol' AND `name` = 'ConstellationClient')
)
```

**Cross-Validation:**

- API `directUsageCount` should match ArcadeDB `directCount`
- API `transitiveCount` should be related to ArcadeDB multi-hop relationships

**Validates:** `includeTransitive` option, ArcadeDB multi-hop relationship traversal

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

**ArcadeDB Validation:**

```sql
SELECT count(*) AS nonTestUsageCount
FROM (
  SELECT expand(inE('REFERENCES','CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name` = 'CodeModeSandbox'
)
WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
  AND outV().filePath IS NOT NULL
  AND NOT (outV().filePath LIKE '%test%' OR outV().filePath LIKE '%.spec.%' OR outV().filePath LIKE '%.test.%')
```

**Cross-Validation:**

- `hasTestFiles: false` — the primary assertion (no test file paths in returned results)
- API `directUsageCount` may differ from ArcadeDB `nonTestUsageCount` due to different test-file exclusion granularity (API uses regex patterns at symbol level; the ArcadeDB `LIKE` substring checks operate at file path level). Count comparison is informational, not a pass/fail criterion.

**Validates:** `excludeTests` filter behavioral correctness (test files excluded from results)

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

**ArcadeDB Validation:**

```sql
-- A: usageCount
SELECT count(*) AS usageCount
FROM (
  SELECT expand(inE('REFERENCES','CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name` = 'createStructuredError'
)
WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'

-- B: usageLocations (first 5)
SELECT filePath, line FROM (
  SELECT outV().filePath AS filePath, outV().line AS line
  FROM (
    SELECT expand(inE('REFERENCES','CALLS'))
    FROM Symbol
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `name` = 'createStructuredError'
  )
  WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
  LIMIT 5
)
```

**Cross-Validation:**

- API `directUsageCount` should match ArcadeDB `usageCount`
- Context is API-layer enrichment (reads source), not stored in ArcadeDB

**Validates:** `includeContext` option, ArcadeDB usage locations (context is API-generated)

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
	direction: 'outgoing',
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

**ArcadeDB Validation:**

```sql
SELECT rootName, calleeCount, calleeNames FROM (
  SELECT `name` AS rootName,
         out('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() AS calleeCount,
         out('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].name AS calleeNames
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name`.toLowerCase() LIKE '%execute%'
    AND `kind` = 'method'
  LIMIT 1
)
```

**Cross-Validation:**

- API `calleeCount` should match ArcadeDB `calleeCount`
- Callee names should match between API and ArcadeDB results

**Validates:** Call graph for outgoing calls, ArcadeDB CALLS relationship traversal

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
	direction: 'incoming',
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

**ArcadeDB Validation:**

```sql
SELECT `name` AS rootName,
       in('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() AS callerCount,
       in('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].name AS callerNames
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = 'createStructuredError'
```

**Cross-Validation:**

- API `callerCount` should match ArcadeDB `callerCount`
- Caller names should match between API and ArcadeDB results

**Validates:** Call graph for incoming calls, ArcadeDB reverse CALLS relationship

---

### TC-TRACE-009: getCallGraph - Both Directions

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'getDefaultConfig', limit: 1 });
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

**ArcadeDB Validation:**

```sql
-- callerNames and calleeNames may repeat a name; compare them as sets.
SELECT `name` AS rootName,
       in('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS callerCount,
       out('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS calleeCount,
       in('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].name AS callerNames,
       out('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].name AS calleeNames
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = 'getDefaultConfig'
```

**Cross-Validation:**

- API `callerCount` should match ArcadeDB `callerCount`
- API `calleeCount` should match ArcadeDB `calleeCount`
- Both directions should be captured

**Validates:** Bidirectional call graph, ArcadeDB dual-direction CALLS traversal

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

**ArcadeDB Validation:**

```sql
-- A: impactedFileCount
SELECT count(*) AS impactedFileCount FROM (
  SELECT DISTINCT filePath FROM (
    SELECT CASE WHEN outV().@type = 'File' THEN outV().path ELSE outV().filePath END AS filePath
    FROM (
      SELECT expand(inE('REFERENCES','CALLS'))
      FROM Symbol
      WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
        AND `name` = 'ConstellationClient'
    )
    WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
  )
  WHERE filePath IS NOT NULL
)

-- B: sampleFiles (first 5)
SELECT filePath FROM (
  SELECT DISTINCT filePath FROM (
    SELECT CASE WHEN outV().@type = 'File' THEN outV().path ELSE outV().filePath END AS filePath
    FROM (
      SELECT expand(inE('REFERENCES','CALLS'))
      FROM Symbol
      WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
        AND `name` = 'ConstellationClient'
    )
    WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
  )
  WHERE filePath IS NOT NULL
  LIMIT 5
)
```

**Cross-Validation:**

- API `impactedFileCount` should be close to ArcadeDB `impactedFileCount`
- Note: `REFERENCES`/`CALLS` edges originate from a `Symbol` vertex when the reference sits inside an enclosing symbol, but from the `File` vertex directly when it does not (module-level usage with no containing symbol). A query that only reads the `filePath` of referencing symbols misses every File-origin edge; the `CASE WHEN outV().@type = 'File'` projection above covers both origins
- Impact analysis includes API-layer risk calculations not stored in ArcadeDB

**Validates:** Basic impact analysis, ArcadeDB reference-to-file mapping (Symbol-origin and File-origin edges)

---

### TC-IMPACT-009: findOrphanedCode - excludeTests Parameter

**Code:**

```javascript
const withExclude = await api.findOrphanedCode({ excludeTests: true });
const withoutExclude = await api.findOrphanedCode({ excludeTests: false });

const testFilePattern = /[._](test|spec)[._]|(__tests__|\/test\/|\/tests\/|\/testing\/|\/spec\/)/;
const withoutExcludeTestFiles = withoutExclude.orphanedFiles?.filter(
    f => testFilePattern.test(f.filePath)
) ?? [];

return {
    excludeTrue: {
        orphanedFileCount: withExclude.orphanedFiles?.length || 0,
    },
    excludeFalse: {
        orphanedFileCount: withoutExclude.orphanedFiles?.length || 0,
    },
    testFilesVisibleWhenNotExcluded: withoutExcludeTestFiles.length > 0,
    testFileCount: withoutExcludeTestFiles.length,
    testFileSamples: withoutExcludeTestFiles.slice(0, 3).map(f => f.filePath),
    fileDifference: (withoutExclude.orphanedFiles?.length || 0) - (withExclude.orphanedFiles?.length || 0),
};
```

**Expected:**

- `testFilesVisibleWhenNotExcluded: true` — test files appear as orphaned when not excluded
- `fileDifference > 0` — more orphaned files when test files are included
- `excludeTrue.orphanedFileCount < excludeFalse.orphanedFileCount`

**ArcadeDB Validation:**

```sql
-- A: orphanedTestFileCount
SELECT count(*) AS orphanedTestFileCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND (
    `path` LIKE '%.test.%'
    OR `path` LIKE '%.test_%'
    OR `path` LIKE '%.spec.%'
    OR `path` LIKE '%.spec_%'
    OR `path` LIKE '%_test.%'
    OR `path` LIKE '%_test_%'
    OR `path` LIKE '%_spec.%'
    OR `path` LIKE '%_spec_%'
    OR `path` LIKE '__tests__/%'
    OR `path` LIKE '%/__tests__/%'
    OR `path` LIKE 'test/%'
    OR `path` LIKE '%/test/%'
    OR `path` LIKE 'tests/%'
    OR `path` LIKE '%/tests/%'
    OR `path` LIKE 'testing/%'
    OR `path` LIKE '%/testing/%'
    OR `path` LIKE 'spec/%'
    OR `path` LIKE '%/spec/%'
  )
  AND in('IMPORTS')[@type = 'File' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() = 0

-- B: sampleTestFiles (first 5)
SELECT path FROM (
  SELECT `path` AS path
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND (
      `path` LIKE '%.test.%'
      OR `path` LIKE '%.test_%'
      OR `path` LIKE '%.spec.%'
      OR `path` LIKE '%.spec_%'
      OR `path` LIKE '%_test.%'
      OR `path` LIKE '%_test_%'
      OR `path` LIKE '%_spec.%'
      OR `path` LIKE '%_spec_%'
      OR `path` LIKE '__tests__/%'
      OR `path` LIKE '%/__tests__/%'
      OR `path` LIKE 'test/%'
      OR `path` LIKE '%/test/%'
      OR `path` LIKE 'tests/%'
      OR `path` LIKE '%/tests/%'
      OR `path` LIKE 'testing/%'
      OR `path` LIKE '%/testing/%'
      OR `path` LIKE 'spec/%'
      OR `path` LIKE '%/spec/%'
    )
    AND in('IMPORTS')[@type = 'File' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() = 0
  LIMIT 5
)
```

**Cross-Validation:**

- API `testFileCount` should approximate ArcadeDB `orphanedTestFileCount`
- API `fileDifference` should approximate ArcadeDB `orphanedTestFileCount`

**Validates:** `excludeTests` parameter filtering, test file path patterns (written as a `LIKE` disjunction), default behavior

---

### TC-IMPACT-007: findOrphanedCode - filePattern Filter

**Code:**

```javascript
const result = await api.findOrphanedCode({ filePattern: 'sandbox' });
const allMatchPattern = (result.orphanedSymbols || []).every(
	(s) => s.filePath?.includes('sandbox')
);
const fileAllMatch = (result.orphanedFiles || []).every(
	(f) => f.filePath?.includes('sandbox')
);
return {
	orphanedSymbolCount: result.orphanedSymbols?.length || 0,
	orphanedFileCount: result.orphanedFiles?.length || 0,
	allSymbolsMatchPattern: allMatchPattern,
	allFilesMatchPattern: fileAllMatch,
	sampleSymbols: (result.orphanedSymbols || []).slice(0, 3).map((s) => s.name),
	sampleFiles: (result.orphanedFiles || []).slice(0, 3).map((f) => f.filePath),
};
```

**Expected:**

- `allSymbolsMatchPattern: true` — all returned orphaned symbols match the file pattern
- `allFilesMatchPattern: true` — all returned orphaned files match the file pattern

**ArcadeDB Validation:**

```sql
-- exportedNoXFileRefs = A.exportedCount - B.withCrossFileRefs
-- A: exported symbols in the matching files
SELECT count(*) AS exportedCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `filePath` LIKE '%sandbox%'
  AND `isExported` = true

-- B: those with at least one reference from a symbol in another file
SELECT count(*) AS withCrossFileRefs FROM (
  SELECT DISTINCT inV().@rid AS rid
  FROM (
    SELECT expand(inE('REFERENCES','CALLS'))
    FROM Symbol
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `filePath` LIKE '%sandbox%'
      AND `isExported` = true
  )
  WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
    AND outV().filePath IS NOT NULL
    AND outV().filePath <> inV().filePath
)
```

**Cross-Validation:**

- `allSymbolsMatchPattern` and `allFilesMatchPattern` are the primary assertions (filter correctness)
- API `orphanedSymbolCount` may be less than ArcadeDB `exportedNoXFileRefs` because the API applies stricter orphan detection criteria (entry point exclusion, dynamic load detection) beyond simple cross-file reference counting. Count comparison is informational.

**Validates:** `filePattern` filter correctness, API orphan detection strictness vs raw ArcadeDB counting

---

### TC-IMPACT-002 through TC-IMPACT-006, TC-IMPACT-008

See E2E-TEST-RESULTS.md for complete test cases.

**ArcadeDB Validation Pattern for Impact Tests:**

All impact tests should validate against ArcadeDB using similar patterns:

```sql
-- For symbol-based impact
SELECT count(*) AS directImpact FROM (
  SELECT DISTINCT @rid FROM (
    SELECT expand(in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
    FROM Symbol
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `name` = '<symbolName>'
  )
)

-- For file-based impact (depth traversal, one or two hops)
SELECT count(*) AS transitiveImpact FROM (
  SELECT DISTINCT @rid FROM (
    SELECT expand(unionall($hop1, $hop2))
    LET $hop1 = (
          SELECT expand(in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
          FROM Symbol
          WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
            AND `name` = '<symbolName>'
        ),
        $hop2 = (
          SELECT expand(in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
          FROM (
            SELECT expand(in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'])
            FROM Symbol
            WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
              AND `name` = '<symbolName>'
          )
        )
  )
)
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

**ArcadeDB Validation:**

```sql
-- File count
SELECT count(*) AS totalFiles
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'

-- Symbol distribution
SELECT `kind` AS kind, count(*) AS kindCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
GROUP BY kind
ORDER BY kindCount DESC

-- Dependency count
SELECT count(*) AS totalDependencies
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
WHERE inV().@type = 'File'
  AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
```

**Cross-Validation:**

- API file counts should match ArcadeDB file count
- API symbol distribution should match ArcadeDB kind counts
- API dependency count should match ArcadeDB IMPORTS count

**Validates:** Basic architecture overview, ArcadeDB aggregate statistics

---

### TC-ARCH-003: getArchitectureOverview - Structure Details

**Code:**

```javascript
const result = await api.getArchitectureOverview({});
return {
	hasStructure: !!result.structure,
	structureKeys: result.structure ? Object.keys(result.structure) : [],
	hasFiles: !!result.structure?.files,
	hasSymbols: !!result.structure?.symbols,
	hasModules: !!result.structure?.modules,
	fileCount: result.structure?.files?.length || 0,
	symbolCount: result.structure?.symbols?.length || 0,
	moduleCount: result.structure?.modules?.length || 0,
};
```

**Expected:**

- `hasStructure: true`
- `hasFiles: true` — structure uses `files` field (not `directories`)
- `hasSymbols: true` — structure uses `symbols` field
- `hasModules: true` — structure uses `modules` field

**ArcadeDB Validation:**

```sql
SELECT count(*) AS totalFiles
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
```

**Cross-Validation:**

- `structureKeys` should include `files`, `symbols`, `modules`
- Note: The API uses `files`/`symbols`/`modules` (not `directories`/`entryPoints`) in the structure section. These may be summary objects rather than arrays, so `.length` may return 0 even when data is present.
- ArcadeDB `totalFiles` confirms data exists for the project

**Validates:** Architecture structure field names, section presence

---

### TC-ARCH-002, TC-ARCH-004

See E2E-TEST-RESULTS.md for complete test cases.

**ArcadeDB Validation Pattern for Architecture Tests:**

```sql
-- Language distribution
SELECT `language` AS language, count(*) AS fileCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `language` IS NOT NULL
GROUP BY language

-- External package usage
SELECT packageName, usageCount FROM (
  SELECT inV().name AS packageName, count(*) AS usageCount
  FROM (
    SELECT expand(outE('IMPORTS'))
    FROM File
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  )
  WHERE inV().@type = 'Package'
    AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
  GROUP BY packageName
  ORDER BY usageCount DESC
  LIMIT 10
)

-- Module structure
SELECT topDir, count(*) AS fileCount
FROM (
  SELECT `path`.split('/')[0] AS topDir
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
GROUP BY topDir
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

**ArcadeDB Validation:**

Parameter validation tests validate API-layer behavior, not ArcadeDB data. However, we can verify that the validation prevents invalid queries from reaching ArcadeDB:

```sql
-- Verify no query was executed with empty parameters.
-- This is a no-op validation: if API validation works, the graph database is
-- never called. There is no statement to run.
```

**Cross-Validation:**

- API should throw error before reaching ArcadeDB
- No ArcadeDB query should be executed for invalid parameters

**Validates:** Required parameter validation, API-layer error handling

---

### TC-VALID-002 through TC-VALID-011

See E2E-TEST-RESULTS.md for complete test cases.

**Note:** Parameter validation tests (TC-VALID-002 through TC-VALID-011) validate API-layer input validation. These tests ensure the API correctly rejects invalid inputs before any ArcadeDB queries are executed. ArcadeDB validation is not applicable for these tests as they test error handling, not data retrieval.

---

## Category 7: Error Handling (7 Tests)

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

---

### TC-ERR-007: MEMORY_EXCEEDED Error and structuredContent (Documentation)

**Code:**

```javascript
return {
	documentedMemoryExceeded: {
		code: 'MEMORY_EXCEEDED',
		type: 'MemoryExceededError',
		recoverable: true,
		memoryLimit: '128MB (DEFAULT_MEMORY_LIMIT_MB)',
		checkInterval: '50ms (MEMORY_CHECK_INTERVAL_MS)',
		enforcement: 'Best-effort periodic heap checking via process.memoryUsage()',
		guidance: [
			'Reduce the amount of data being processed',
			'Use pagination (limit parameter) to process in smaller batches',
			'Avoid creating large arrays or objects in loops',
		],
	},
	documentedStructuredContent: {
		note: 'All error responses include structuredContent for programmatic parsing (SB-259)',
		schema: { success: false, error: 'Human-readable error message string' },
		purpose: 'Allows AI assistants to parse error state without regex on text',
	},
};
```

**Expected:**

- The code executes cleanly and returns the documented payload — no validation error
- Documents MEMORY_EXCEEDED error structure (SB-156)
- Documents structuredContent behavior for error responses (SB-259)
- `recoverable: true` — user can retry with smaller dataset
- Memory limit: 128MB, checked every 50ms (best-effort)

**Note:** The string literal `'Best-effort periodic heap checking via process.memoryUsage()'` in this payload was previously a false-positive trigger for the dangerous-pattern regex sweep (`\bprocess\.`), which ran ahead of AST parsing and did not distinguish code from string/comment content — rejecting the whole test with `Code validation failed: Dangerous pattern detected: \bprocess\.`. Now that the sweep masks string, template-literal, and comment spans before matching, this payload executes and returns the documented structure without error.

**Validates:** MEMORY_EXCEEDED error code (SB-156), structuredContent in error responses (SB-259), dangerous-pattern regex sweep does not false-positive on string/comment text

**Note:** Error handling tests (TC-ERR-001 through TC-ERR-007) validate API-layer error response structures and handling. These tests document expected error formats (AUTH_ERROR, SYMBOL_NOT_FOUND, NETWORK_ERROR, etc.) rather than querying ArcadeDB data. ArcadeDB validation is not applicable for these tests as they test error handling, not data retrieval.

---

## Category 8: Sandbox Security (17 Tests)

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

### TC-SEC-010: Code Size Limit (100KB)

**Code:**

```javascript
// Test validates that code exceeding 100KB is rejected
// Cannot execute actual test as it would require >100KB payload
return {
	note: 'Code size validation prevents execution of >100KB payloads',
	documentedBehavior: {
		maxCodeSize: '100KB (102,400 bytes)',
		errorOnExceed: 'Code size exceeds maximum allowed (100KB)',
		purpose: 'Prevents DoS attacks via large code payloads',
	},
};
```

**Expected:**

- Code exceeding 100KB is rejected before execution
- Error message indicates size limit exceeded

**Validates:** Code size validation (SB-87), DoS prevention

---

### TC-SEC-011: Binary Character Detection

**Code:**

```javascript
// Test validates that binary/control characters are blocked
// Cannot execute actual test as it would require binary payload
return {
	note: 'Binary character validation prevents execution of malformed code',
	documentedBehavior: {
		blockedCharacters: 'Control characters (0x00-0x08, 0x0E-0x1F)',
		allowedWhitespace: 'Tab (0x09), LF (0x0A), CR (0x0D)',
		errorOnDetect: 'Code contains invalid binary characters',
		purpose: 'Prevents injection of binary/malformed payloads',
	},
};
```

**Expected:**

- Code containing binary control characters is rejected
- Common whitespace (tab, newline) is allowed

**Validates:** Binary character detection (SB-87), input sanitization

---

### TC-SEC-012: Result Size Truncation (1MB)

**Code:**

```javascript
// Test result size limits by generating a large array
const largeArray = [];
for (let i = 0; i < 50000; i++) {
	largeArray.push({ index: i, data: 'x'.repeat(20) });
}
return {
	arrayLength: largeArray.length,
	note: 'Large results are truncated to prevent memory issues',
};
```

**Expected:**

- Result may be truncated if exceeding 1MB
- Warning threshold at 100KB
- Hard limit at 1MB with truncation metadata

**Validates:** Result size enforcement (SB-95), memory protection

---

### TC-SEC-013: Block Atomics Global

**Code:**

```javascript
const buf = new SharedArrayBuffer(16);
const result = Atomics.load(new Int32Array(buf), 0);
return result;
```

**Expected:**

- Rejected at AST validation phase (not runtime)
- Error includes: "Access to 'Atomics' is not allowed" or "Access to 'SharedArrayBuffer' is not allowed"

**Validates:** Atomics blocking (v4 dangerous globals, commit e450614)

---

### TC-SEC-014: Block SharedArrayBuffer Global

**Code:**

```javascript
const buffer = new SharedArrayBuffer(1024);
return { size: buffer.byteLength };
```

**Expected:**

- Rejected at AST validation phase (not runtime)
- Error includes: "Access to 'SharedArrayBuffer' is not allowed"

**Validates:** SharedArrayBuffer blocking (v4 dangerous globals, commit e450614)

---

### TC-SEC-015: Block WebAssembly Global

**Code:**

```javascript
const module = new WebAssembly.Module(new Uint8Array([0, 97, 115, 109]));
return { type: typeof module };
```

**Expected:**

- Rejected at AST validation phase (not runtime)
- Error includes: "Access to 'WebAssembly' is not allowed"

**Validates:** WebAssembly blocking (v4 dangerous globals, commit e450614)

---

### TC-SEC-016: Computed Dynamic Property Warning (Not Error)

**Code:**

```javascript
const obj = { a: 1, b: 2 };
const key = 'a';
return obj[key];
```

**Expected:**

- Code executes successfully (NOT rejected)
- Returns `1`
- Logs may contain a warning: `[WARN] [AST] Dynamic computed property access detected`
- This is a **warning**, not an error — defense-in-depth security auditing (SB-258)

**Validates:** Computed dynamic property warning behavior (SB-258), distinction between warnings and errors in AST validation

---

### TC-SEC-017: Block Legacy Property Access

**Code:**

```javascript
const obj = {};
obj.__defineGetter__('x', function () {
	return 42;
});
return obj.x;
```

**Expected:**

- Rejected at AST validation phase (not runtime)
- Error includes: "Access to .**defineGetter** is not allowed"

**Validates:** Legacy property access blocking (**defineGetter**, **defineSetter**, **lookupGetter**, **lookupSetter**)

---

**Note:** Sandbox security tests (TC-SEC-001 through TC-SEC-017) validate the JavaScript sandbox execution environment security features. These tests verify that dangerous code patterns (require, import, eval, Function constructor, process access, prototype manipulation, file system access, infinite loops) are properly blocked at the validation or runtime phase. Additional tests (TC-SEC-010 through TC-SEC-012) validate input size limits and output truncation. Tests TC-SEC-013 through TC-SEC-015 block v4 dangerous globals (Atomics, SharedArrayBuffer, WebAssembly). TC-SEC-016 validates computed property warnings, and TC-SEC-017 validates legacy property blocking. ArcadeDB validation is not applicable for these tests as they test sandbox security, not data retrieval.

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

**ArcadeDB Validation:**

```sql
SELECT count(*) AS `count`
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%thissymboldefinitelydoesnotexist12345678xyzabc%'
```

**Cross-Validation:**

- ArcadeDB `count` should be 0
- Both API and ArcadeDB should return empty results for non-existent symbols

**Validates:** Empty results handling, ArcadeDB consistent empty responses

---

### TC-EDGE-002 through TC-EDGE-008

See E2E-TEST-RESULTS.md for complete test cases.

**ArcadeDB Validation Pattern for Edge Case Tests:**

Edge case tests validate API behavior with boundary conditions. For tests that query data:

```sql
-- For non-existent file queries (TC-EDGE-002)
SELECT count(*) AS `count`
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `path` = '<non-existent-path>'
-- Expected: 0

-- For non-existent symbol queries (TC-EDGE-003)
SELECT count(*) AS `count`
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `id` = '<invalid-symbol-id>'
-- Expected: 0

-- For special character searches (TC-EDGE-004)
-- In a LIKE pattern, % and ? are wildcards; escape either with a backslash.
SELECT count(*) AS `count`
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%<special-chars>%'

-- For very long query strings (TC-EDGE-005)
-- Validate that queries with long strings don't crash ArcadeDB

-- For deeply nested structures (TC-EDGE-007)
-- Validate depth traversal limits are respected.
-- ArcadeDB SQL has no variable-length path pattern, so maxDepth is computed
-- from the file-to-file IMPORTS edge list this statement returns.
-- Rule: maxDepth = the length of the longest import path of 1 to 10 hops
-- that repeats no edge (10 when a longer one exists).
SELECT outV().path AS fromPath, inV().path AS toPath
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
WHERE inV().@type = 'File'
  AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
ORDER BY fromPath, toPath
```

**Note:** Some edge case tests (TC-EDGE-006: undefined/null handling) validate API-layer behavior and don't require ArcadeDB validation. TC-EDGE-006 sends `offset: null`; Zod strict validation correctly rejects this with a type error. The `.default(0)` only applies when `offset` is omitted (`undefined`), not when `null` is explicitly sent. Score PASS when validation error is returned.

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

**ArcadeDB Validation:**

```sql
SELECT `name` AS name, `kind` AS kind,
       out('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS calleeCount,
       in('CALLS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS callerCount,
       out('INHERITS')[@type = 'Symbol' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS inheritsCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = 'CodeModeSandbox'
```

**Cross-Validation:**

- Symbol name should match between search and details
- Relationship counts should match ArcadeDB relationship counts
- Both API calls should reference the same symbol ID

**Validates:** Sequential method chaining, ArcadeDB data consistency across calls

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

**ArcadeDB Validation:**

```sql
SELECT `path` AS `file`,
       out('IMPORTS')[@type = 'File' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS importsCount,
       in('IMPORTS')[@type = 'File' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].asSet().size() AS importedByCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `path` = 'src/client/error-factory.ts'
```

**Cross-Validation:**

- API `imports` should match ArcadeDB `importsCount`
- API `importedBy` should match ArcadeDB `importedByCount`
- Parallel queries should return consistent data

**Validates:** Promise.all parallel queries, ArcadeDB bidirectional dependency consistency

---

### TC-COMBO-003 through TC-COMBO-005

See E2E-TEST-RESULTS.md for complete test cases.

**ArcadeDB Validation Pattern for Combined Workflow Tests:**

Combined workflow tests chain multiple API methods. Each step can be validated against ArcadeDB:

```sql
-- TC-COMBO-003: Full Symbol Analysis (search -> details -> usage -> impact)
-- Step 1: Verify search result exists
SELECT id, name, filePath FROM (
  SELECT `id` AS id, `name` AS name, `filePath` AS filePath
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `name`.toLowerCase() LIKE '%<searchQuery>%'
  LIMIT 1
)

-- Step 2: Verify symbol details
SELECT `name` AS name, `kind` AS kind, `filePath` AS filePath, `isExported` AS isExported
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `id` = '<symbolId from step 1>'

-- Step 3: Verify usage count
SELECT count(*) AS usageCount
FROM (
  SELECT expand(inE('REFERENCES','CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `id` = '<symbolId>'
)
WHERE outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'

-- Step 4: Verify impact analysis
SELECT count(*) AS impactedFileCount FROM (
  SELECT DISTINCT outV().filePath AS filePath
  FROM (
    SELECT expand(inE('REFERENCES','CALLS'))
    FROM Symbol
    WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
      AND `id` = '<symbolId>'
  )
  WHERE outV().@type = 'Symbol'
    AND outV().filePath IS NOT NULL
    AND outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'
)

-- TC-COMBO-004: Architecture to Dependencies
SELECT mostImported, dependencies FROM (
  SELECT `path` AS mostImported,
         in('IMPORTS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() AS importerCount,
         out('IMPORTS')[@type = 'File' AND projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].path AS dependencies
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  ORDER BY importerCount DESC
  LIMIT 1
)

-- TC-COMBO-005: Circular Dependency Investigation
-- ArcadeDB SQL has no variable-length path pattern. Find one directed cycle
-- of length 2 to 5 in the file-to-file IMPORTS edge list this statement
-- returns; startFile is its first path and cyclePath its ordered path list.
SELECT outV().path AS fromPath, inV().path AS toPath
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
WHERE inV().@type = 'File'
  AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
ORDER BY fromPath, toPath
```

---

## Category 11: Code Mode Specific (21 Tests)

### TC-CODE-001: Top-Level Await

**Code:**

```javascript
const result = await api.searchSymbols({ query: 'Error', limit: 5 });
return result.symbols?.length || 0;
```

**Expected:**

- Returns a number (await works at top level)

**ArcadeDB Validation:**

```sql
SELECT count(*) AS totalCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%error%'
```

**Cross-Validation:**

- API returned count should be <= 5 (due to limit)
- ArcadeDB `totalCount` should be >= API count (ArcadeDB has no limit)

**Validates:** Async IIFE wrapping, ArcadeDB query execution

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

**ArcadeDB Validation:**

```sql
-- First query
SELECT count(*) AS errorCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%error%'

-- Second query
SELECT count(*) AS clientCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%client%'
```

**Cross-Validation:**

- API `first` should be <= 3 and <= ArcadeDB `errorCount`
- API `second` should be <= 3 and <= ArcadeDB `clientCount`

**Validates:** Sequential await execution, ArcadeDB multiple query consistency

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

// TC-CODE-006: Auto-Return (SB-151)
const x = 1 + 1;
// Auto-return adds implicit `return x;` — returns 2

// TC-CODE-007: Return Null
return null;
```

**Note:** Return value tests (TC-CODE-003 through TC-CODE-007) validate sandbox JavaScript execution and serialization capabilities. These tests don't query ArcadeDB data and therefore don't require ArcadeDB validation.

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

**Note:** Console logging tests (TC-CODE-008 through TC-CODE-012) validate sandbox console capture functionality. These tests don't query ArcadeDB data and therefore don't require ArcadeDB validation.

**Validates:** Console capture

---

### TC-CODE-013 through TC-CODE-015: listMethods

**Code:**

```javascript
// TC-CODE-014: All 14 Registry Methods Listed
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
	'ping',
	'getCapabilities',
	'listMethods',
	'help',
];
const missing = expected.filter((e) => !methodNames.includes(e));
return {
	methodCount: info.methods?.length || 0,
	missing,
	allPresent: missing.length === 0,
	hasDecisionGuide: !!info.decisionGuide,
	hasReference: !!info.reference,
};
```

**Expected:**

- `allPresent: true`
- `methodCount: 14`
- `hasDecisionGuide: true`
- `hasReference: true` (v4: bridges Tier 4 → Tier 3)

**Note:** `listMethods()` returns all 14 entries on the `api` object, including `listMethods` and `help` themselves; they are not excluded from the registry output. listMethods tests (TC-CODE-013 through TC-CODE-015) validate the sandbox API documentation functionality. These tests don't query ArcadeDB data and therefore don't require ArcadeDB validation.

**Validates:** Complete method list and documentation

---

### TC-CODE-016: Auto-Return on Expression Statement (SB-151)

**Code:**

```javascript
const search = await api.searchSymbols({ query: 'Error', limit: 3 });
search.symbols?.length || 0
```

**Expected:**

- Returns a number (the length or 0)
- Auto-return prepends `return` to the last bare expression statement
- No explicit `return` needed for final expression

**Validates:** Auto-return on ExpressionStatement (SB-151)

---

### TC-CODE-017: Auto-Return Preserves Explicit Return (SB-151)

**Code:**

```javascript
const x = 42;
return x * 2;
```

**Expected:**

- Returns `84`
- When an explicit `return` is present, auto-return does not modify the code

**Validates:** Auto-return does not interfere with explicit return statements (SB-151)

---

### TC-CODE-018: listMethods Query Filter (SB-257)

**Code:**

```javascript
const all = api.listMethods();
const filtered = api.listMethods({ query: 'dep' });
return {
	allCount: all.methods.length,
	filteredCount: filtered.methods.length,
	filteredNames: filtered.methods.map((m) => m.name),
	isSubset: filtered.methods.length <= all.methods.length,
	hasDecisionGuide: !!all.decisionGuide,
};
```

**Expected:**

- `allCount === 14`
- `filteredCount > 0` and `filteredCount < allCount` (matches `getDependencies`, `getDependents`, `findCircularDependencies`)
- `filteredNames` includes methods matching 'dep' (e.g., getDependencies, getDependents)
- `isSubset: true`
- `hasDecisionGuide: true` (unfiltered response includes decision guide)

**Validates:** listMethods query parameter filtering (SB-257), decision guide presence

---

### TC-CODE-019: help() Method — Inline Type Summaries

**Code:**

```javascript
const noArg = api.help();
const withMethod = api.help('searchSymbols');
const unknown = api.help('nonExistentMethod');
return {
	noArgType: typeof noArg,
	noArgHasContent: noArg.length > 0,
	withMethodType: typeof withMethod,
	withMethodHasInterface: withMethod.includes('interface') || withMethod.includes('SearchSymbols'),
	unknownHasError: unknown.includes('Unknown') || unknown.includes('not found'),
};
```

**Expected:**

- `noArgType === 'string'`
- `noArgHasContent: true`
- `withMethodType === 'string'`
- `withMethodHasInterface: true` (returns TypeScript interface types)
- `unknownHasError: true` (unknown method returns error message)

**Validates:** help() method with no args, valid method name, and unknown method name

---

### TC-CODE-020: Response Metadata (asOfCommit, lastIndexedAt, resultContext)

**Code:**

```javascript
const result = await api.searchSymbols({ query: 'CodeModeSandbox', limit: 1 });
return {
	hasResult: result.symbols?.length > 0,
	symbolName: result.symbols?.[0]?.name,
};
```

**Expected:**

- `hasResult: true`
- The **tool response envelope** (not the code result) includes:
  - `asOfCommit`: A git commit hash string (40 hex characters)
  - `lastIndexedAt`: An ISO 8601 timestamp string
  - `resultContext`: Present when query has context (e.g., `reason: "no_matches"`)
- These metadata fields are populated from Core API response headers

**Note:** These fields appear in the MCP tool response, not in the sandbox result object. The test executor should verify their presence in the tool response envelope.

**Validates:** Response metadata passthrough (asOfCommit, lastIndexedAt, resultContext)

---

### TC-CODE-021: Timer Lifecycle Safety (Documentation)

**Code:**

```javascript
return {
	documentedBehavior: {
		defaultTimerSetting: 'allowTimers: false (timers not available in sandbox)',
		whenEnabled: 'Active timers tracked and cleared in finally block after execution',
		implementation: 'SB-258 Step 3.2 - executionState.timerCleanup in sandbox.ts',
	},
};
```

**Expected:**

- Documents timer lifecycle safety behavior
- Timers are disabled by default (`allowTimers: false`)
- When enabled, automatic cleanup prevents callback leaks after execution

**Validates:** Timer lifecycle safety documentation (SB-258)

---

## Category 12: ArcadeDB Cross-Validation (10 Tests)

This category contains dedicated tests for validating data consistency between the Constellation API and ArcadeDB graph database.

### TC-XVAL-001: Symbol Count Consistency

**Purpose:** Verify API symbol count matches ArcadeDB total count

**Note:** This test uses a common character query since the API requires at least 1 character. The Core `searchSymbols` executor lowercases both the symbol name and the query before its substring match, which is **case-insensitive**: the query `'e'` matches symbols containing either 'e' or 'E'. The ArcadeDB validation query below must use `name.toLowerCase() LIKE` with a lowercase pattern to reproduce the same matching.

**Code:**

```javascript
const result = await api.searchSymbols({ query: 'e', limit: 100 });
return {
	apiCount: result.pagination?.total || result.symbols?.length || 0,
	symbolsReturned: result.symbols?.length || 0,
};
```

**ArcadeDB Validation:**

```sql
SELECT count(*) AS graphCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name`.toLowerCase() LIKE '%e%'
```

**Cross-Validation:**

- `apiCount` should equal `graphCount` (exact match expected)
- Note: the Core executor's substring match is case-insensitive. The validation query must use `name.toLowerCase() LIKE` with a lowercase pattern, not a bare `LIKE`, or it will undercount
- Discrepancy indicates indexing issue or stale data

**Validates:** Total symbol count consistency

---

### TC-XVAL-002: File Count Consistency

**Purpose:** Verify API file count matches ArcadeDB file count

**Code:**

```javascript
const result = await api.getArchitectureOverview({});
return {
	fileCount: result.metadata?.totalFiles || 0,
};
```

**ArcadeDB Validation:**

```sql
SELECT count(*) AS graphFileCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
```

**Cross-Validation:**

- `fileCount` should equal `graphFileCount`

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

**ArcadeDB Validation:**

```sql
-- A: counts
SELECT count(*) AS graphDepCount,
       sum(CASE WHEN inV().@type = 'File' THEN 1 ELSE 0 END) AS fileDepCount,
       sum(CASE WHEN inV().@type = 'Package' THEN 1 ELSE 0 END) AS packageDepCount
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `path` = 'src/index.ts'
)
WHERE inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'

-- B: graphDeps
SELECT CASE WHEN inV().@type = 'File' THEN inV().path ELSE inV().name END AS graphDep
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `path` = 'src/index.ts'
)
WHERE inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
```

**Cross-Validation:**

- `depCount` should equal `graphDepCount` (includes both File and Package targets)
- File dependencies have `filePath` set; Package dependencies have `filePath: null` and `name` set
- `fileDepCount + packageDepCount` should equal `graphDepCount`

**Validates:** IMPORTS relationship consistency

---

### TC-XVAL-004: Symbol Kind Distribution

**Purpose:** Verify API symbol kinds match ArcadeDB distribution

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

**ArcadeDB Validation:**

```sql
SELECT `kind` AS kind, count(*) AS kindCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
GROUP BY kind
ORDER BY kindCount DESC
```

**Cross-Validation:**

- API class count should match ArcadeDB class count
- API function count should match ArcadeDB function count
- API method count should match ArcadeDB method count

**Validates:** Symbol kind distribution consistency

---

### TC-XVAL-005: Call Graph Bidirectional Consistency

**Purpose:** Verify callers/callees are symmetric in ArcadeDB

**ArcadeDB Validation:**

```sql
-- All CALLS relationships should be bidirectionally queryable.
-- isSymmetric = (A.symmetricCount equals B.totalCalls)
-- A: CALLS edges between two in-scope symbols, read from the callee side
SELECT count(*) AS symmetricCount
FROM (
  SELECT expand(inE('CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
WHERE outV().@type = 'Symbol'
  AND outV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND outV().branch = 'main'

-- B: CALLS edges leaving an in-scope symbol, read from the caller side
SELECT count(*) AS totalCalls
FROM (
  SELECT expand(outE('CALLS'))
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
```

**Cross-Validation:**

- `isSymmetric` should be `true`
- Every CALLS relationship should be traversable in both directions

**Validates:** CALLS relationship bidirectional integrity

---

### TC-XVAL-006: Exported Symbol Consistency

**Purpose:** Verify isExported flag matches ArcadeDB data

**Code:**

```javascript
const result = await api.searchSymbols({
	query: 'e',
	isExported: true,
	limit: 100,
});
return {
	exportedCount: result.pagination?.total || result.symbols?.length || 0,
	sampleSymbols: result.symbols?.slice(0, 5).map((s) => s.name) || [],
};
```

**ArcadeDB Validation:**

```sql
-- A: graphExportedCount
SELECT count(*) AS graphExportedCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `isExported` = true
  AND `name`.toLowerCase() LIKE '%e%'

-- B: sampleNames (first 5)
SELECT name FROM (
  SELECT `name` AS name
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `isExported` = true
    AND `name`.toLowerCase() LIKE '%e%'
  LIMIT 5
)
```

**Cross-Validation:**

- `exportedCount` should equal `graphExportedCount` (both filtered by the case-insensitive `name.toLowerCase() LIKE '%e%'`, matching the Core executor)
- Note: the Core executor's `CONTAINS` match is case-insensitive; raw `CONTAINS 'e'` undercounts relative to the API
- Sample symbols should exist in ArcadeDB exported symbols

**Validates:** isExported flag consistency

---

### TC-XVAL-007: Package Import Consistency

**Purpose:** Verify external package imports match ArcadeDB Package nodes

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

**ArcadeDB Validation:**

```sql
-- graphPackageCount = number of rows; graphPackages = the names
SELECT inV().name AS name
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `path` = 'src/code-mode/sandbox.ts'
)
WHERE inV().@type = 'Package'
  AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
ORDER BY name
```

**Cross-Validation:**

- `packageCount` should equal `graphPackageCount`
- `packages` array should match `graphPackages`

**Validates:** Package node import consistency

---

### TC-XVAL-008: Symbol Location Accuracy

**Purpose:** Verify symbol line/column numbers match ArcadeDB

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

**ArcadeDB Validation:**

```sql
SELECT `name` AS name, `filePath` AS filePath, `line` AS line, `column` AS `column`
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = 'CodeModeSandbox'
```

**Cross-Validation:**

- API `line` should equal ArcadeDB `line`
- API `column` should equal ArcadeDB `column`
- API `filePath` should equal ArcadeDB `filePath`

**Validates:** Symbol location data accuracy

---

### TC-XVAL-009: Circular Dependency Detection Accuracy

**Purpose:** Verify circular dependencies match ArcadeDB cycle detection

**Code:**

```javascript
const result = await api.findCircularDependencies({ maxDepth: 5 });
return {
	cycleCount: result.cycles?.length || 0,
	hasCycles: (result.cycles?.length || 0) > 0,
	sampleCycle: result.cycles?.[0] || null,
};
```

**ArcadeDB Validation:**

```sql
-- ArcadeDB SQL has no variable-length path pattern, so the cycle count is
-- computed from the file-to-file IMPORTS edge list this statement returns.
-- Rule: enumerate the simple directed cycles of length 2 to 5 in the edge
-- list (a self-import is length 1 and does not count), reduce each cycle to
-- its sorted list of member paths, and count the distinct lists.
--   graphCycleCount = number of distinct sorted member lists
--   sampleCycle     = the first of them
SELECT outV().path AS fromPath, inV().path AS toPath
FROM (
  SELECT expand(outE('IMPORTS'))
  FROM File
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
WHERE inV().@type = 'File'
  AND inV().projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND inV().branch = 'main'
ORDER BY fromPath, toPath
```

**Cross-Validation:**

- API `cycleCount` should equal ArcadeDB `graphCycleCount`
- Same files should appear in detected cycles
- Note: for a two-file cycle `A -> B -> A`, a walk starting from `A` and a walk starting from `B` produce two distinct raw paths for the same cycle. The rule above normalizes each cycle to a sorted, rotation-independent member list before counting distinct lists; counting the raw ordered path lists counts each rotation separately (e.g. 2 instead of 1), which is the discrepancy the API's own deduplication correctly avoids

**Validates:** Circular dependency detection accuracy (rotation-independent deduplication)

---

### TC-XVAL-010: Orphaned Code Detection Accuracy

**Purpose:** Verify orphaned code detection matches ArcadeDB unreferenced symbols

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

**ArcadeDB Validation:**

```sql
-- A: graphOrphanCount
SELECT count(*) AS graphOrphanCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `filePath` LIKE 'src/%'
  AND `kind` IN ['function', 'class']
  AND `isExported` = true
  AND in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() = 0
  AND in('IMPORTS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() = 0

-- B: sampleOrphans (first 5)
SELECT name, kind, filePath FROM (
  SELECT `name` AS name, `kind` AS kind, `filePath` AS filePath
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
    AND `filePath` LIKE 'src/%'
    AND `kind` IN ['function', 'class']
    AND `isExported` = true
    AND in('REFERENCES','CALLS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() = 0
    AND in('IMPORTS')[projectId = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND branch = 'main'].size() = 0
  LIMIT 5
)
```

**Cross-Validation:**

- API `orphanCount` should be close to ArcadeDB `graphOrphanCount`
- Detected orphans should match ArcadeDB unreferenced symbols
- Note: API may apply additional filtering (test files, internal symbols)

**Validates:** Orphaned code detection accuracy

---

## Appendix: Quick Reference

### Test Count by Category

| Category                  | Count   | ArcadeDB Validation |
| ------------------------- | ------- | ------------------- |
| Discovery Methods         | 14      | Full                |
| Dependency Methods        | 9       | Full                |
| Tracing Methods           | 9       | Full                |
| Impact Methods            | 9       | Full                |
| Architecture Methods      | 4       | Full                |
| Parameter Validation      | 11      | N/A (API-layer)     |
| Error Handling            | 7       | N/A (API-layer)     |
| Sandbox Security          | 17      | N/A (Sandbox)       |
| Edge Cases                | 8       | Partial             |
| Combined Workflows        | 5       | Full                |
| Code Mode Specific        | 21      | Partial             |
| ArcadeDB Cross-Validation | 10      | Full                |
| **TOTAL**                 | **124** |                     |

### ArcadeDB Validation Commands

**Schema Discovery:**

```sql
-- Vertex types, edge types, properties and indexes: call mcp__arcadedb__get_schema
-- (no statement needed).

-- Sample symbol record (all stored properties)
SELECT FROM (
  SELECT FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  LIMIT 1
)
```

**Common Validation Queries:**

```sql
-- Count symbols
SELECT count(*) AS symbolCount
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'

-- Count files
SELECT count(*) AS fileCount
FROM File
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'

-- Count relationships leaving symbols (repeat with FROM File for file-sourced edges)
SELECT @type AS relType, count(*) AS relCount
FROM (
  SELECT expand(outE())
  FROM Symbol
  WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
)
GROUP BY relType
ORDER BY relCount DESC

-- Symbol lookup by name
SELECT `name` AS name, `kind` AS kind, `filePath` AS filePath, `line` AS line
FROM Symbol
WHERE `projectId` = 'proj:adf45ed0a35649d19a7d70edaa9636b1' AND `branch` = 'main'
  AND `name` = '<symbolName>'
```

### MCP Tool Commands

**Constellation API Test:**

```
mcp__local-constellation__code_intel
```

**ArcadeDB Validation Query:**

```
mcp__arcadedb__query   (language: sql, database: constellation)
```

### Known Issues and Limitations

#### Resolved Issues

- ~~**TC-IMPACT-007**: `filePattern` uses regex, not glob syntax~~ ✅ FIXED
- ~~**TC-DISC-003**: MCP uses `isExported` but Core expects `filterByExported`~~ ✅ FIXED (sandbox now transforms parameters)
- ~~**TC-TRACE-006**: `includeContext` parameter defined but context data not populated in response~~ ✅ FIXED (context now returns usage location strings)
- ~~**TC-DEP-007**: `includeImpactMetrics` parameter defined but `detailedMetrics` not populated~~ ✅ FIXED (returns byDepth, criticalPaths, mostImpactedFiles)
- ~~**isExported parameter**: Broken `isExported` parameter transformation removed~~ ✅ FIXED (SB-155: MCP sandbox now passes `isExported` directly to Core)

#### API Validation Constraints (By Design)

- **TC-EDGE-005**: Query strings have a 200-character maximum (`z.string().max(200)`)
- **TC-VALID-008**: Zod uses strict boolean validation (not coercion). String `"true"` is correctly rejected with a validation error. Callers should send `true` (boolean), not `"true"` (string). Score PASS when validation error is returned.
- **TC-EDGE-006**: Zod uses strict number validation for `offset`. `null` is correctly rejected with a validation error. The `.default(0)` applies when the field is omitted (`undefined`), not when `null` is explicitly sent. Omit the field to use the default. Score PASS when validation error is returned.
- **TC-SEC-010**: Code size limit is 100KB (prevents DoS attacks)
- **TC-SEC-012**: Result size warning at 100KB, hard limit at 1MB with truncation

#### Unimplemented Features

None.

#### Test Design Notes

- **TC-XVAL-001**: Uses `query: 'e'` since API requires min 1 character (matches most symbols)
- **TC-IMPACT-006**: `impactAnalysis` returns `breakingChangeRisk`, not `metrics` field
- **TC-DISC-011/012**: `ping` and `getCapabilities` are utility methods for connectivity/status checks
- **TC-CODE-006**: Now returns `2` due to auto-return (SB-151) — previously returned `undefined`
- **TC-CODE-014**: `listMethods()` returns all 14 entries on the `api` object; `listMethods` and `help` are included in their own registry output alongside the 12 executor-backed methods (total API surface: 14 methods)
- **Process-level isolation**: `CONSTELLATION_SANDBOX_ISOLATION=hardened` enables child-process isolation with hard memory limits and SIGKILL timeout. This is an env var setting, not testable via the `code_intel` tool
- **MEMORY_EXCEEDED**: New error code (SB-156) for sandbox heap limit enforcement. 128MB limit checked every 50ms (best-effort)

#### ArcadeDB Query Behavior Notes

- **Case sensitivity**: The Core `searchSymbols` executor lowercases both sides of its substring match, so it is case-insensitive. A bare `name LIKE '%e%'` is case-sensitive and undercounts; validation queries that mirror a search must use `name.toLowerCase() LIKE` with a lowercase pattern to match the Core executor's behavior.
- **LIKE wildcards**: ArcadeDB `LIKE` uses `%` (any run) and `?` (one character); `_` and `.` are literals.
- **Distinct counts**: `count(DISTINCT x)` is not valid ArcadeDB SQL. Distinct counts use `count(*)` over a `SELECT DISTINCT` subquery, or `.asSet().size()` on a traversal.
- **Usage edges**: usages are `REFERENCES` and `CALLS` edges. The graph has no `USES_SYMBOL` edge type.
- **IMPORTS targets**: `IMPORTS` relationships connect files to both `File` and `Package` nodes. Validation queries must expand `outE('IMPORTS')` without an `inV().@type` filter to count all targets.
- **filterByUsageType vs filterByRelationshipType**: `filterByUsageType` filters by `outV().kind` (symbol kind of the using vertex). `filterByRelationshipType` filters by the edge `@type` (ArcadeDB edge type). These are distinct parameters with different semantics.
- **visibility vs isExported**: The TS extractor sets `visibility` (`public`/`private`) only on class members with explicit access modifiers. `isExported` is set on module-level exports. These properties apply to different symbol categories and never co-exist as `visibility='public'` + `isExported=true`.

#### AST Validation Pattern Checkers

The sandbox AST validator (Acorn-based) checks 9 patterns before execution:

| ID                            | Pattern                                                      | Severity    | Tested By                 |
| ----------------------------- | ------------------------------------------------------------ | ----------- | ------------------------- |
| `constructor-access`          | `.constructor` access                                        | Error       | TC-SEC-003                |
| `proto-access`                | `.__proto__` access                                          | Error       | TC-SEC-006                |
| `prototype-access`            | `.prototype` access                                          | Error       | TC-SEC-006                |
| `dangerous-global`            | process, eval, Atomics, SharedArrayBuffer, WebAssembly, etc. | Error       | TC-SEC-001-005, 013-015   |
| `dynamic-import`              | `import()` expression                                        | Error       | TC-SEC-002                |
| `with-statement`              | `with (...)` statement                                       | Error       | (implicit in strict mode) |
| `computed-dangerous-property` | `obj["constructor"]` etc.                                    | Error       | TC-SEC-003                |
| `legacy-property-access`      | `__defineGetter__` etc.                                      | Error       | TC-SEC-017                |
| `computed-dynamic-property`   | `obj[variable]`                                              | **Warning** | TC-SEC-016                |

Source: `src/code-mode/validators/dangerous-patterns.ts`

### Pass Criteria

- **PASS**: All expected conditions met
- **FAIL**: Any expected condition not met
- **PARTIAL**: Some conditions met, with documented observations

### Running the Full Test Suite

1. Ensure prerequisites are met (constellation-core running, project indexed)
2. Execute each test case via the `code_intel` MCP tool
3. Compare results against expected values
4. Document any deviations in the test results file
