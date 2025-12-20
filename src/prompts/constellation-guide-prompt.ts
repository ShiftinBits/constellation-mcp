/**
 * Constellation Guide Prompt Registration
 *
 * Provides comprehensive guidance for AI coding assistants on how to effectively
 * use the Constellation MCP Code Mode for code intelligence and analysis.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Get the comprehensive guide content for AI assistants
 */
function getGuideContent(): string {
	return `# Constellation MCP - Code Mode Guide

## How It Works

Constellation uses **Code Mode**: one tool (\`execute_code\`) that runs JavaScript code with access to the \`api\` object. Write code to call API methods, chain operations, and return results.

\`\`\`javascript
// Basic example - find a function and get its details
const search = await api.searchSymbols({ query: "handleAuth" });
const details = await api.getSymbolDetails({ symbolId: search.symbols[0].id });
return { search, details };
\`\`\`

## Key Principles

1. **Always use \`await\`** - All API methods are async
2. **Always \`return\` results** - Otherwise output is undefined
3. **Use \`Promise.all()\`** - For parallel operations (much faster)
4. **Use \`api.listMethods()\`** - To see available methods

---

## API Reference

| Method | Parameters | Returns | Use When |
|--------|------------|---------|----------|
| \`api.searchSymbols()\` | query, filterByKind?, limit? | { symbols[], pagination? } | Finding functions, classes, variables |
| \`api.getSymbolDetails()\` | symbolId OR symbolName+filePath | { symbol, references?, relationships? } | Getting full symbol info |
| \`api.getDependencies()\` | filePath, depth? | { directDependencies[], transitiveDependencies? } | What does this file import? |
| \`api.getDependents()\` | filePath, depth? | { directDependents[], transitiveDependents? } | What imports this file? |
| \`api.traceSymbolUsage()\` | symbolId OR symbolName+filePath | { directUsages[] } | Where is this symbol used? |
| \`api.getCallGraph()\` | symbolId OR symbolName+filePath, direction? | { root, callers?, callees? } | Function call relationships |
| \`api.impactAnalysis()\` | symbolId OR symbolName+filePath | { impactedFiles[], summary, breakingChangeRisk? } | Change impact assessment |
| \`api.findCircularDependencies()\` | filePath?, maxDepth? | { cycles[] } | Find import cycles |
| \`api.findOrphanedCode()\` | filePattern?, filterByKind? | { orphanedSymbols[], orphanedFiles[] } | Find unused/dead code |
| \`api.getArchitectureOverview()\` | includeMetrics? | { metadata, structure, dependencies } | High-level project structure |

---

## Common Patterns

### Pattern 1: Basic Search
\`\`\`javascript
const result = await api.searchSymbols({
  query: "UserService",
  filterByKind: ["class"],
  limit: 10
});
return result.symbols.map(s => ({ name: s.name, file: s.filePath, line: s.line }));
\`\`\`

### Pattern 2: Parallel Queries (Fast)
\`\`\`javascript
// Run multiple queries at once - 3x faster than sequential
const [symbols, architecture, orphaned] = await Promise.all([
  api.searchSymbols({ query: "Controller", limit: 20 }),
  api.getArchitectureOverview({ includeMetrics: true }),
  api.findOrphanedCode({ limit: 10 })
]);
return {
  controllers: symbols.symbols.length,
  totalFiles: architecture.structure.files.total,
  deadCode: orphaned.orphanedSymbols.length
};
\`\`\`

### Pattern 3: Chained Analysis
\`\`\`javascript
// Find symbol, then analyze its impact
const search = await api.searchSymbols({ query: "calculateTotal", limit: 1 });
if (search.symbols.length === 0) return { error: "Not found" };

const symbol = search.symbols[0];
const [details, usage, impact] = await Promise.all([
  api.getSymbolDetails({ symbolId: symbol.id }),
  api.traceSymbolUsage({ symbolId: symbol.id }),
  api.impactAnalysis({ symbolId: symbol.id })
]);

return {
  name: symbol.name,
  file: symbol.filePath,
  usageCount: usage.directUsages?.length || 0,
  riskLevel: impact.breakingChangeRisk?.riskLevel || "unknown"
};
\`\`\`

### Pattern 4: Error Handling
\`\`\`javascript
try {
  const result = await api.getSymbolDetails({ symbolName: "MissingClass", filePath: "src/missing.ts" });
  return result;
} catch (error) {
  return { error: error.message, suggestion: "Check if symbol exists with searchSymbols first" };
}
\`\`\`

---

## Complete Workflow Examples

### Workflow 1: Understanding a Function
\`\`\`javascript
const functionName = "processOrder";

// Find the function
const search = await api.searchSymbols({ query: functionName, filterByKind: ["function"], limit: 1 });
if (search.symbols.length === 0) return { error: "Function not found: " + functionName };

const symbol = search.symbols[0];

// Get comprehensive info in parallel
const [details, callGraph, usage] = await Promise.all([
  api.getSymbolDetails({ symbolId: symbol.id, includeRelationships: true }),
  api.getCallGraph({ symbolId: symbol.id, direction: "both", depth: 2 }),
  api.traceSymbolUsage({ symbolId: symbol.id, limit: 20 })
]);

return {
  function: {
    name: symbol.name,
    file: symbol.filePath,
    line: symbol.line,
    signature: details.symbol?.signature
  },
  calls: callGraph.callees?.map(c => c.name) || [],
  calledBy: callGraph.callers?.map(c => c.name) || [],
  usedIn: usage.directUsages?.map(u => u.filePath) || []
};
\`\`\`

### Workflow 2: Refactoring Impact Analysis
\`\`\`javascript
const filePath = "src/utils/helpers.ts";

// Get dependents and impact in parallel
const [dependents, impact] = await Promise.all([
  api.getDependents({ filePath, depth: 2 }),
  api.impactAnalysis({ filePath })
]);

// Calculate risk
const directCount = dependents.directDependents?.length || 0;
const transitiveCount = dependents.transitiveDependents?.length || 0;
const riskLevel = impact.breakingChangeRisk?.riskLevel || "unknown";

return {
  file: filePath,
  directDependents: directCount,
  transitiveDependents: transitiveCount,
  totalImpactedFiles: impact.impactedFiles?.length || 0,
  riskLevel,
  recommendations: impact.breakingChangeRisk?.recommendations || [],
  safeToRefactor: riskLevel === "low" && directCount < 5
};
\`\`\`

### Workflow 3: Find and Analyze Dead Code
\`\`\`javascript
// Find orphaned code
const orphaned = await api.findOrphanedCode({
  filePattern: "src/**",
  exportedOnly: true,
  limit: 20
});

// Verify each is truly unused by checking dependents
const verifiedOrphans = [];
for (const symbol of orphaned.orphanedSymbols.slice(0, 5)) {
  const deps = await api.getDependents({ filePath: symbol.filePath });
  if (deps.directDependents.length === 0) {
    verifiedOrphans.push({
      name: symbol.name,
      file: symbol.filePath,
      kind: symbol.kind,
      confidence: symbol.confidence
    });
  }
}

return {
  totalOrphaned: orphaned.orphanedSymbols.length,
  verified: verifiedOrphans,
  safeToDelete: verifiedOrphans.filter(o => o.confidence > 0.8)
};
\`\`\`

### Workflow 4: Resolve Circular Dependencies
\`\`\`javascript
// Find circular dependencies
const cycles = await api.findCircularDependencies({ maxDepth: 5 });

if (cycles.cycles.length === 0) {
  return { message: "No circular dependencies found" };
}

// Analyze the shortest cycle for easier resolution
const shortestCycle = cycles.cycles.sort((a, b) => a.length - b.length)[0];

// Get dependencies for each file in cycle
const fileAnalysis = await Promise.all(
  shortestCycle.cycle.map(async (filePath) => {
    const deps = await api.getDependencies({ filePath });
    return {
      file: filePath,
      imports: deps.directDependencies.map(d => d.filePath)
    };
  })
);

return {
  totalCycles: cycles.cycles.length,
  shortestCycle: shortestCycle.cycle,
  analysis: fileAnalysis,
  suggestion: "Extract shared code to break the cycle"
};
\`\`\`

---

## Semantic Markers

API results include markers to highlight characteristics:

| Marker | Meaning |
|--------|---------|
| [EXPORTED] | Public symbol - changes affect consumers |
| [INTERNAL] | Private - safe to change within module |
| [TEST] | Test file - lower production risk |
| [UNUSED] | Never imported - deletion candidate |
| [HEAVILY_USED] | 20+ usages - high impact |
| [HIGH_IMPACT] | Critical to many dependents |
| [BREAKING] | Breaking change risk |
| [SAFE] | Safe to modify/delete |

---

## Best Practices

1. **Use \`Promise.all()\` for parallel calls** - 3-10x faster than sequential
2. **Check array lengths before accessing** - Avoid undefined errors
3. **Start with small limits** - Increase only if needed
4. **Chain from search to details** - Search first, then get specifics
5. **Use \`console.log()\` for debugging** - Logs appear in response

## Error Handling

If you get an error:
1. Check if symbol/file exists with \`searchSymbols\` first
2. Verify required parameters (symbolId OR symbolName+filePath)
3. Check CONSTELLATION_ACCESS_KEY is set
4. Read error message for guidance

---

This is a **Code Mode** MCP server. Write JavaScript code to interact with all capabilities.`;
}

/**
 * Register the constellation-guide prompt with the MCP server
 *
 * @param server - The McpServer instance to register the prompt with
 */
export function registerConstellationGuidePrompt(server: McpServer): void {
	server.registerPrompt(
		'constellation-guide',
		{
			title: 'Constellation Code Mode Guide',
			description:
				'Guide for AI assistants on using Constellation MCP Code Mode - write JavaScript to access all API capabilities',
			argsSchema: {}, // No arguments needed
		},
		async () => ({
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: getGuideContent(),
					},
				},
			],
		}),
	);

	console.error('[constellation-guide] Prompt registered successfully');
}
