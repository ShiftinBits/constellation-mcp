# Constellation Code Mode

## Overview

Code Mode is a powerful feature that transforms how AI assistants interact with the Constellation MCP tools. Instead of making sequential tool calls, the AI writes TypeScript/JavaScript code that directly calls the Constellation API, enabling complex multi-step analysis with custom logic.

## Why Code Mode?

### Traditional MCP Tool Calling
```
AI → Tool 1 → Result → AI → Tool 2 → Result → AI → Tool 3 → Final Result
```
Each step requires a full LLM round-trip, processing the entire context again.

### Code Mode
```
AI → Write Code → Execute Once → Final Result
```
The AI writes a complete analysis script that runs in one go.

## Benefits

1. **Performance**: 10x faster for complex workflows (single execution vs multiple LLM round-trips)
2. **Natural for LLMs**: Code is the native language of language models
3. **Flexibility**: Write custom filters, aggregations, and analysis logic
4. **Parallel Execution**: Use `Promise.all()` to run multiple operations concurrently
5. **Reusability**: Save and share analysis scripts

## Getting Started

### Basic Usage

The `execute_code` tool accepts TypeScript or JavaScript code:

```typescript
// Simple example: Find all User-related classes
const result = await api.searchSymbols({
  query: "User",
  filterByKind: ["class"],
  limit: 20
});

return result.symbols.map(s => ({
  name: s.name,
  file: s.filePath
}));
```

### Available API Methods

All 10 Constellation tools are available as API methods:

- `searchSymbols(params)` - Search for symbols by name/pattern
- `getSymbolDetails(params)` - Get detailed symbol information
- `getDependencies(params)` - Find what a file depends on
- `getDependents(params)` - Find what depends on a file
- `findCircularDependencies(params)` - Detect circular references
- `traceSymbolUsage(params)` - Find where symbols are used
- `getCallGraph(params)` - Get function call relationships
- `findOrphanedCode(params)` - Find unused code
- `impactAnalysis(params)` - Analyze change impact
- `getArchitectureOverview(params)` - Get codebase structure

## Advanced Examples

### 1. Find Unused Exports

```typescript
// Find all exported symbols
const symbols = await api.searchSymbols({
  query: '',
  filterByExported: true,
  limit: 100
});

// Check usage for each symbol in parallel
const usages = await Promise.all(
  symbols.symbols.map(s =>
    api.traceSymbolUsage({
      symbolName: s.name,
      filePath: s.filePath
    })
  )
);

// Filter unused symbols
const unused = symbols.symbols.filter((s, i) =>
  usages[i].totalUsages === 0
);

return {
  count: unused.length,
  symbols: unused.map(s => ({
    name: s.name,
    type: s.kind,
    file: s.filePath
  }))
};
```

### 2. Analyze Refactoring Impact

```typescript
const targetSymbol = "UserService";

// Find the symbol
const search = await api.searchSymbols({
  query: targetSymbol,
  limit: 1
});

if (search.symbols.length === 0) {
  return { error: "Symbol not found" };
}

const symbol = search.symbols[0];

// Parallel analysis of multiple aspects
const [usage, deps, dependents, impact] = await Promise.all([
  api.traceSymbolUsage({
    symbolName: symbol.name,
    filePath: symbol.filePath
  }),
  api.getDependencies({
    filePath: symbol.filePath
  }),
  api.getDependents({
    filePath: symbol.filePath
  }),
  api.impactAnalysis({
    symbolName: symbol.name,
    filePath: symbol.filePath
  })
]);

// Calculate risk score
let risk = 0;
if (usage.totalUsages > 50) risk += 3;
if (dependents.totalCount > 10) risk += 2;
if (deps.totalCount > 20) risk += 1;

return {
  symbol: symbol.name,
  usageCount: usage.totalUsages,
  dependencyCount: deps.totalCount,
  dependentCount: dependents.totalCount,
  riskLevel: risk >= 4 ? "HIGH" : risk >= 2 ? "MEDIUM" : "LOW",
  recommendation: risk >= 4
    ? "Consider gradual refactoring with feature flags"
    : "Safe to refactor directly"
};
```

### 3. Find Critical Path Dependencies

```typescript
// Find the most critical files (most depended upon)
const files = await api.searchSymbols({
  query: '',
  filterByKind: ['class', 'interface'],
  limit: 100
});

// Get dependents for each file
const dependentCounts = await Promise.all(
  files.symbols.map(async (symbol) => {
    const deps = await api.getDependents({
      filePath: symbol.filePath,
      limit: 1 // Just need the count
    });
    return {
      file: symbol.filePath,
      symbol: symbol.name,
      dependents: deps.totalCount
    };
  })
);

// Sort by criticality
dependentCounts.sort((a, b) => b.dependents - a.dependents);

// Get top 10 critical files
const critical = dependentCounts.slice(0, 10);

// Analyze circular dependencies for critical files
const circularChecks = await Promise.all(
  critical.map(async (item) => {
    const circles = await api.findCircularDependencies({
      filePath: item.file,
      limit: 5
    });
    return {
      ...item,
      hasCircularDeps: circles.totalCount > 0,
      circularCount: circles.totalCount
    };
  })
);

return {
  criticalFiles: circularChecks,
  summary: {
    total: files.symbols.length,
    critical: circularChecks.filter(f => f.dependents > 20).length,
    withCircularDeps: circularChecks.filter(f => f.hasCircularDeps).length
  }
};
```

## Helper Utilities

Code Mode includes helper utilities to simplify common patterns:

### Workflow Builder

```typescript
const workflow = new WorkflowBuilder(api);

const result = await workflow
  .step(async (api) => {
    // Step 1: Find symbols
    return api.searchSymbols({ query: "Controller" });
  })
  .step(async (api, previous) => {
    // Step 2: Get details for first symbol
    const symbol = previous.symbols[0];
    return api.getSymbolDetails({
      symbolName: symbol.name,
      filePath: symbol.filePath
    });
  })
  .execute();
```

### Filter Builder

```typescript
const filter = new FilterBuilder()
  .inFiles("src/services/**")
  .ofKind("class", "interface")
  .exported(true)
  .paginate(50, 0);

const results = await api.searchSymbols({
  query: "Service",
  ...filter.build()
});
```

### Pagination Helper

```typescript
const paginator = new PaginationHelper(api, 'searchSymbols');

// Fetch all results across multiple pages
const allSymbols = await paginator.fetchAll(
  { query: "Handler" },
  10 // max pages
);
```

## Best Practices

### Do's
- ✓ Use `await` with all API calls
- ✓ Use `Promise.all()` for parallel operations
- ✓ Return meaningful results
- ✓ Handle empty results gracefully
- ✓ Use helper utilities for complex workflows

### Don'ts
- ✗ Don't use `require()` or `import`
- ✗ Don't try to access the file system directly
- ✗ Don't create infinite loops
- ✗ Don't make sequential calls in loops (use Promise.all)
- ✗ Don't forget to return results

## Security

Code Mode runs in a sandboxed environment with:

- **No file system access**: Can't read or write files directly
- **No network access**: Can't make HTTP requests
- **No process access**: Can't spawn processes or access system
- **Timeout protection**: Maximum 30-60 second execution time
- **Memory limits**: Restricted memory usage

## Troubleshooting

### Common Errors

1. **"api is not defined"**
   - The api object is automatically available, don't try to import it

2. **"Execution timeout"**
   - Code took too long to execute
   - Optimize by using Promise.all() for parallel operations
   - Reduce data set size with limits

3. **"Cannot use import statement"**
   - All necessary functions are pre-loaded
   - Use the provided api object and helpers

4. **"Symbol not found"**
   - Check spelling and case sensitivity
   - Use broader search patterns
   - Verify the symbol exists in the indexed codebase

## Examples Repository

Find more Code Mode examples in `/docs/code-mode/examples/`:

- `basic-queries.ts` - Simple search and lookup operations
- `workflows.ts` - Complex multi-step workflows
- `analysis-patterns.ts` - Common analysis patterns
- `performance-optimizations.ts` - Tips for faster execution

## Migration Guide

### Converting from Traditional Tool Calls

Traditional approach:
```
1. Call search_symbols with query="User"
2. For each result, call get_symbol_details
3. For each detail, call trace_symbol_usage
4. Aggregate results
```

Code Mode approach:
```typescript
const symbols = await api.searchSymbols({ query: "User" });
const details = await Promise.all(
  symbols.symbols.map(s =>
    api.getSymbolDetails({
      symbolName: s.name,
      filePath: s.filePath
    })
  )
);
// Process all at once
```

## Performance Comparison

| Operation | Traditional | Code Mode | Improvement |
|-----------|------------|-----------|-------------|
| Find unused exports (100 symbols) | 45s | 3s | 15x |
| Refactoring impact analysis | 12s | 1.5s | 8x |
| Circular dependency detection | 20s | 2s | 10x |
| Complex workflow (10 steps) | 30s | 2.5s | 12x |

## Contributing

To add new capabilities to Code Mode:

1. Add new tool to `src/tools/`
2. Create tool definition in `src/registry/tool-definitions/`
3. Run `npm run codegen` to regenerate API
4. Update documentation with examples

## Support

For issues or questions about Code Mode:

1. Check the examples in `/docs/code-mode/examples/`
2. Review common patterns in this guide
3. Submit issues to the constellation-mcp repository