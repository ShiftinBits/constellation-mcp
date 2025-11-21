# Code Mode Quick Reference

## Quick Start

```javascript
// Execute code using the api object
const result = await api.searchSymbols({
  query: "MyClass",
  types: ["class"]
});

console.log("Found:", result.symbols.length, "symbols");
return result;
```

## The 10 API Methods

| Method | Use Case | Key Parameters |
|--------|----------|----------------|
| `searchSymbols` | Find symbols by name/pattern | `query`, `types[]` |
| `getSymbolDetails` | Get detailed symbol info | `symbolName`, `filePath` |
| `getDependencies` | What file depends on | `filePath`, `depth` |
| `getDependents` | What depends on file | `filePath`, `depth` |
| `findCircularDependencies` | Detect circular refs | `maxDepth` |
| `traceSymbolUsage` | Find all symbol usages | `symbolName`, `filePath`, `depth` |
| `getCallGraph` | Function call relationships | `symbolId`/`functionName`, `filePath` |
| `impactAnalysis` | Assess change impact | `symbolName`, `filePath`, `analysisDepth` |
| `findOrphanedCode` | Find unused code | `includeTests`, `minConfidence` |
| `getArchitectureOverview` | Project structure | `includeMetrics`, `depth` |

## Common Patterns

### Pattern: Parallel Execution
```javascript
const [result1, result2, result3] = await Promise.all([
  api.searchSymbols({query: "Client", types: ["class"]}),
  api.findOrphanedCode({minConfidence: 0.9}),
  api.findCircularDependencies({maxDepth: 10})
]);
```

### Pattern: Chained Analysis
```javascript
// Step 1: Find symbol
const search = await api.searchSymbols({
  query: "MyClass",
  types: ["class"]
});

const symbol = search.symbols[0];

// Step 2: Analyze impact
const impact = await api.impactAnalysis({
  symbolName: symbol.name,
  filePath: symbol.filePath,
  analysisDepth: 3
});

// Step 3: Check usage
const usage = await api.traceSymbolUsage({
  symbolName: symbol.name,
  filePath: symbol.filePath,
  depth: 2
});
```

### Pattern: Defensive Coding
```javascript
const result = await api.searchSymbols({query: "foo"});

// Always check for existence
const symbols = result.symbols || [];
const count = symbols.length;

if (count === 0) {
  console.log("No symbols found");
  return;
}

// Safe to use symbols now
symbols.forEach(s => console.log(s.name));
```

## Tips & Tricks

### ✅ DO:
- Use JavaScript mode: `language: "javascript"`
- Break down property access into separate variables
- Use `Promise.all()` for parallel execution
- Check for null/undefined before accessing properties
- Use `console.log()` for debugging

### ❌ DON'T:
- Chain property access on same line (TypeScript mode)
- Use empty query strings
- Ignore error cases
- Assume data exists without checking

## Error Handling

```javascript
try {
  const result = await api.getSymbolDetails({
    symbolName: "MyClass",
    filePath: "path/to/file.ts"
  });
  console.log("Found symbol");
} catch (error) {
  console.log("Error:", error.message);
  // Handle gracefully
}
```

## Performance Tips

1. **Use parallel execution** when operations are independent
2. **Limit depth** parameters (2-3 usually sufficient)
3. **Filter results** early to reduce processing
4. **Batch similar operations** together

## Example: Complete Workflow

```javascript
// Comprehensive analysis workflow
console.log("Analyzing codebase...");

// Phase 1: Parallel data gathering
const [arch, circular, orphaned] = await Promise.all([
  api.getArchitectureOverview({includeMetrics: true, depth: 2}),
  api.findCircularDependencies({maxDepth: 10}),
  api.findOrphanedCode({includeTests: false, minConfidence: 0.85})
]);

console.log("Phase 1 complete");

// Phase 2: Detailed analysis
const orphanedSymbols = orphaned.orphanedSymbols || [];

for (let i = 0; i < Math.min(orphanedSymbols.length, 5); i++) {
  const sym = orphanedSymbols[i];

  const usage = await api.traceSymbolUsage({
    symbolName: sym.name,
    filePath: sym.filePath,
    depth: 2
  });

  if (usage.usageLocations.length === 0) {
    console.log("Confirmed orphaned:", sym.name);
  }
}

console.log("Analysis complete");

return {
  orphanedSymbols: orphanedSymbols.length,
  circularDependencies: circular.circularDependencies.length
};
```

## Debugging

```javascript
// Enable detailed logging
console.log("Step 1: Searching...");
const result = await api.searchSymbols({query: "foo"});
console.log("Result:", JSON.stringify(result, null, 2));

// Check data structure
console.log("Type:", typeof result);
console.log("Has symbols:", result.hasOwnProperty("symbols"));
console.log("Symbols length:", result.symbols ? result.symbols.length : "undefined");
```

## Common Issues

### Issue: "Cannot read properties of undefined"
**Solution**: Always check for existence before accessing
```javascript
// BAD:
const count = result.symbols.length;

// GOOD:
const symbols = result.symbols || [];
const count = symbols.length;
```

### Issue: "Query must contain at least 1 character"
**Solution**: Provide non-empty query string
```javascript
// BAD:
await api.searchSymbols({query: ""});

// GOOD:
await api.searchSymbols({query: "MyClass"});
```

### Issue: Slow execution
**Solution**: Use parallel execution
```javascript
// SLOW (sequential):
const r1 = await api.searchSymbols({...});
const r2 = await api.findOrphanedCode({...});

// FAST (parallel):
const [r1, r2] = await Promise.all([
  api.searchSymbols({...}),
  api.findOrphanedCode({...})
]);
```

---

**Quick Reference Version**: 1.0
**Last Updated**: 2025-11-21
**Status**: Production Ready
