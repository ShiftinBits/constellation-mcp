/**
 * Server-Level Instructions for AI Assistants
 *
 * These instructions are returned during MCP initialization and help AI assistants
 * understand how to use Constellation's Code Mode effectively.
 *
 * CRITICAL: This is the ONLY mechanism for providing AI guidance - no prompts are registered.
 */

/**
 * Get comprehensive server instructions for AI assistants
 *
 * Returned via MCP initialize response to help AI assistants:
 * - Understand Code Mode architecture (single tool, JavaScript execution)
 * - Know when to use Constellation vs other tools
 * - Write effective API calls with proper patterns
 * - Avoid common mistakes
 */
export function getServerInstructions(): string {
	return `
# Constellation MCP Server - Code Mode

Code intelligence from AST graph. One tool: \`execute_code\` — write JS with the \`api\` object.
Constellation = structure & relationships. \`Read\` tool = source code.

## ACTIVATION RULES

Invoke \`execute_code\` **proactively** when detecting these intents:

| Intent | Method | Shorthand |
|--------|--------|-----------|
| "Where is X defined?" | \`searchSymbols()\` | \`api.search(q)\` |
| "What uses/imports X?" | \`getDependents()\` | \`api.dependents(path)\` |
| "What does X depend on?" | \`getDependencies()\` | \`api.deps(path)\` |
| "Safe to change/delete X?" | \`impactAnalysis()\` | \`api.impact(id)\` |
| "Find unused/dead code" | \`findOrphanedCode()\` | \`api.orphans()\` |
| "Show project structure" | \`getArchitectureOverview()\` | \`api.overview()\` |
| "Circular dependencies?" | \`findCircularDependencies()\` | \`api.cycles()\` |
| "What calls X? / Trace usage" | \`getCallGraph()\` | \`api.calls(id)\` |
| "Check connection" | \`ping()\` | \`api.ping()\` |

**Critical Rules**: Always \`await\`. Last expression auto-returned (explicit \`return\` for control flow). \`Promise.all()\` for parallel (3-10x faster). Use \`symbolId\` from search results. No comments in code.

**Fallback**: \`Read\`/\`Edit\`/\`Write\` for source. \`Grep\` for text search. \`Glob\` for file patterns. Not indexed → \`constellation index\`.

### Capability Check
\`\`\`javascript
const caps = await api.getCapabilities();
if (!caps.isIndexed) return { error: "Not indexed", suggestion: "Run: constellation index" };
\`\`\`

## Patterns

### Discovery
\`\`\`javascript
api.listMethods()
\`\`\`
Returns method metadata, intent-to-method mapping, and composition recipes.

### Chained Analysis
\`\`\`javascript
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

### Error Handling
\`\`\`javascript
try {
  const result = await api.getSymbolDetails({ symbolName: "MissingClass", filePath: "src/missing.ts" });
  return result;
} catch (error) {
  return { error: error.message, suggestion: "Check if symbol exists with searchSymbols first" };
}
\`\`\`

## API Reference

| Method | Parameters | Returns | Use When |
|--------|-----------|---------|----------|
| \`api.searchSymbols()\` | query, filterByKind?, limit? | \`{ symbols[], pagination? }\` | Finding functions, classes, variables |
| \`api.getSymbolDetails()\` | symbolId OR symbolName+filePath | \`{ symbol, references?, relationships? }\` | Getting full symbol info |
| \`api.getDependencies()\` | filePath, depth? | \`{ file, directDependencies[], transitive? }\` | What does this file import? |
| \`api.getDependents()\` | filePath, depth? | \`{ file, directDependents[], transitive? }\` | What imports this file? |
| \`api.traceSymbolUsage()\` | symbolId OR symbolName+filePath | \`{ symbol, directUsages[], transitive? }\` | Where is this symbol used? |
| \`api.getCallGraph()\` | symbolId OR symbolName+filePath, direction? | \`{ root, callers?, callees? }\` | Function call relationships |
| \`api.impactAnalysis()\` | symbolId OR symbolName+filePath | \`{ summary, breakingChangeRisk?, impactedFiles[] }\` | Change impact assessment |
| \`api.findCircularDependencies()\` | filePath?, maxDepth? | \`{ cycles[], totalCycles }\` | Find import cycles |
| \`api.findOrphanedCode()\` | filePattern?, filterByKind? | \`{ orphanedSymbols[], orphanedFiles[] }\` | Find unused/dead code |
| \`api.getArchitectureOverview()\` | includeMetrics? | \`{ metadata, structure, dependencies }\` | High-level project structure |
| \`api.ping()\` | (none) | \`{ pong: true }\` | Verify authentication and API connectivity |

## Shorthand Aliases

Positional-arg shortcuts for common operations:

| Shorthand | Delegates To | Example |
|-----------|-------------|---------|
| \`api.search(query, opts?)\` | \`searchSymbols\` | \`await api.search("User")\` |
| \`api.details(symbolId)\` | \`getSymbolDetails\` | \`await api.details(id)\` |
| \`api.deps(filePath, opts?)\` | \`getDependencies\` | \`await api.deps("src/index.ts")\` |
| \`api.dependents(filePath, opts?)\` | \`getDependents\` | \`await api.dependents("src/utils.ts")\` |
| \`api.impact(idOrName, file?, opts?)\` | \`impactAnalysis\` | \`await api.impact("UserService", "src/user.ts")\` |
| \`api.usage(idOrName, file?, opts?)\` | \`traceSymbolUsage\` | \`await api.usage(symbol.id)\` |
| \`api.calls(idOrName, file?, opts?)\` | \`getCallGraph\` | \`await api.calls("processOrder", "src/orders.ts")\` |
| \`api.orphans(opts?)\` | \`findOrphanedCode\` | \`await api.orphans({ limit: 20 })\` |
| \`api.cycles(opts?)\` | \`findCircularDependencies\` | \`await api.cycles()\` |
| \`api.overview(opts?)\` | \`getArchitectureOverview\` | \`await api.overview()\` |

**Smart resolution** (\`impact\`, \`usage\`, \`calls\`): 1 string = symbolId, 2 strings = symbolName + filePath.

## Type Definitions

Three levels of type access (quick → detailed → exhaustive):

1. **Returns column above** — top-level response shape at a glance
2. **Per-method resource** — readable interfaces with field descriptions (~30-50 lines):
   \`\`\`
   constellation://types/api/{methodName}
   \`\`\`
   Examples: \`constellation://types/api/searchSymbols\`, \`constellation://types/api/impactAnalysis\`
   Also accepts shorthands: \`constellation://types/api/search\`, \`constellation://types/api/impact\`

3. **Full type definitions** — complete Zod schemas for all methods (~147KB):
   \`\`\`
   constellation://types/api
   \`\`\`

Start with the Returns column. Read a per-method resource when you need exact field names. Use the full resource only for edge cases.

## Best Practices

- **Depth**: Use \`depth=1\` first, increase only if needed. Depth grows **EXPONENTIALLY**: depth=1~10 files, depth=2~100 files, depth=3~1000+ files
- **symbolId**: After \`searchSymbols\`, use returned \`symbolId\` in follow-up calls — precise, fast, unambiguous
- **Parallel**: Use \`Promise.all()\` for independent queries (3-10x faster). Check array lengths before accessing elements
- **Filtering**: Set \`excludeTests=true\` for production-only impact analysis. Use \`includeReferences\` only when needed (can be large for popular symbols)

## Multi-Project Workspaces

When working in a workspace with multiple Constellation-indexed projects (monorepos, submodules):

**IMPORTANT**: Provide the \`cwd\` parameter to ensure queries target the correct project.

\`\`\`javascript
// Without cwd - uses server's default project (may be wrong in multi-project setup)
await api.searchSymbols({ query: "UserService" })

// With cwd - explicitly targets the correct project
// Pass cwd at the tool level, not in the api call:
execute_code({
  code: 'return await api.searchSymbols({ query: "UserService" })',
  cwd: "/path/to/specific/project"
})
\`\`\`

**How it works:**
1. Provide your current working directory as \`cwd\` in the execute_code call
2. Server walks upward to find the git repository root
3. Loads \`constellation.json\` from that git root
4. Uses that project's configuration for all API calls in that execution

**When to provide cwd:**
- Working in a monorepo with multiple indexed projects
- Working in a workspace with git submodules
- When queries return unexpected results (might be querying wrong project)
- When you switch between projects in the same session
`.trim();
}
