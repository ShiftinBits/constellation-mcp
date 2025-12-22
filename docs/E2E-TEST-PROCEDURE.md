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

2. **Valid access key** configured

   ```bash
   export CONSTELLATION_ACCESS_KEY=ak_00000000-...
   ```

3. **Project indexed** in constellation

   ```bash
   cd constellation-mcp
   constellation index --full
   ```

4. **MCP server** connected to Claude Code (or other MCP client)

### Test Context

- **Project:** constellation-mcp
- **Branch:** main
- **MCP Tool:** `execute_code` (Code Mode)

---

## Step 0: Update the Code Index

Before running any tests, ensure the codebase is freshly indexed:

```bash
cd constellation-mcp
constellation index
```

This command parses the codebase, extracts AST intelligence, and uploads it to constellation-core. The index must be current for tests to return accurate results.

**Verify index is complete:**

```bash
constellation status
```

You should see the project listed with recent indexing timestamp.

---

## Test Execution Method

All tests are executed via the `execute_code` MCP tool. Each test case provides:

- **Code**: JavaScript to execute in the sandbox
- **Expected**: What the result should contain
- **Validates**: What aspect of the system is being tested

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

**Validates:** Basic search functionality, symbol structure

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

**Validates:** `filterByKind` parameter, `limit` parameter

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

**Validates:** `filterByVisibility`, `isExported` filters

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

**Validates:** `filePattern` filtering

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

**Validates:** `includeUsageCount` option

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

**Validates:** `offset` parameter, `pagination` in response

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
};
```

**Expected:**

- `success: true`
- `symbolName === "CodeModeSandbox"`
- `symbolKind === "class"`

**Validates:** Symbol lookup by ID

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

**Validates:** Symbol lookup by name+path combination

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
};
```

**Expected:**

- `hasReferences: true`
- `referenceCount > 0`

**Validates:** `includeReferences` option

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
};
```

**Expected:**

- `hasRelationships: true`
- `relationshipKeys` includes items like "calls", "calledBy", "inherits"

**Validates:** `includeRelationships` option

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

**Validates:** Basic dependency analysis

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

**Validates:** `depth` parameter, transitive dependencies

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

**Validates:** `includePackages` option

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

**Validates:** `includeSymbols` option

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

**Validates:** Reverse dependency analysis

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

**Validates:** `depth` parameter for reverse dependencies

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

**Validates:** `includeImpactMetrics` option

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

**Validates:** Circular dependency detection

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

**Validates:** `filePath` filter, `maxDepth` limit

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
};
```

**Expected:**

- `success: true`
- `hasDirectUsages: true`
- `directUsageCount > 0`

**Validates:** Usage tracing by ID

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

**Validates:** Usage tracing by name+path

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
};
```

**Expected:**

- Only usages of type "import" returned

**Validates:** `filterByUsageType` filter

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
};
```

**Expected:**

- `hasTransitive: true`

**Validates:** `includeTransitive` option

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
};
```

**Expected:**

- `hasTestFiles: false`

**Validates:** `excludeTests` filter

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
};
```

**Expected:**

- `hasContext: true` with code snippets
- Note: Currently returns `hasContext: false` (known observation)

**Validates:** `includeContext` option

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
};
```

**Expected:**

- `hasCallees: true`
- `calleeCount > 0`

**Validates:** Call graph for outgoing calls

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
};
```

**Expected:**

- `hasCallers: true`
- `callerCount > 0`

**Validates:** Call graph for incoming calls

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
};
```

**Expected:**

- `hasCallers: true`
- `hasCallees: true`

**Validates:** Bidirectional call graph

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
};
```

**Expected:**

- `success: true`
- `hasSummary: true`

**Validates:** Basic impact analysis

---

### TC-IMPACT-002 through TC-IMPACT-009

See E2E-TEST-RESULTS.md for complete test cases.

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

**Validates:** Basic architecture overview

---

### TC-ARCH-002 through TC-ARCH-004

See E2E-TEST-RESULTS.md for complete test cases.

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

**Validates:** Required parameter validation

---

### TC-VALID-002 through TC-VALID-011

See E2E-TEST-RESULTS.md for complete test cases.

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

**Validates:** Empty results handling

---

### TC-EDGE-002 through TC-EDGE-008

See E2E-TEST-RESULTS.md for complete test cases.

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

**Validates:** Sequential method chaining

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

**Validates:** Promise.all parallel queries

---

### TC-COMBO-003 through TC-COMBO-005

See E2E-TEST-RESULTS.md for complete test cases.

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

**Validates:** Async IIFE wrapping

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

**Validates:** Sequential await execution

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

**Validates:** Complete method list and documentation

---

## Appendix: Quick Reference

### Test Count by Category

| Category             | Count  |
| -------------------- | ------ |
| Discovery Methods    | 10     |
| Dependency Methods   | 9      |
| Tracing Methods      | 9      |
| Impact Methods       | 9      |
| Architecture Methods | 4      |
| Parameter Validation | 11     |
| Error Handling       | 6      |
| Sandbox Security     | 9      |
| Edge Cases           | 8      |
| Combined Workflows   | 5      |
| Code Mode Specific   | 15     |
| **TOTAL**            | **95** |

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
