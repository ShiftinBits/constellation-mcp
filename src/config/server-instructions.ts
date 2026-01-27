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

Provides **centralized code intelligence** from a shared graph database built from AST analysis.
Use Constellation instead of manual file searching when you need to understand code structure,
dependencies, relationships, or impact of changes.

## AUTOMATIC ACTIVATION RULES

Invoke \`execute_code\` **proactively** (without asking user) when detecting these intent patterns:

| User Intent Pattern | Constellation Method | Why Not Other Tools |
|---------------------|---------------------|---------------------|
| "Where is X defined?" | \`api.searchSymbols()\` | Returns location + metadata, faster than Glob+Grep |
| "What uses X?" / "Who imports X?" | \`api.getDependents()\` | Traces usage across entire codebase |
| "What does X depend on?" | \`api.getDependencies()\` | Shows full import graph with depth |
| "Is it safe to change/delete X?" | \`api.impactAnalysis()\` | Reveals hidden consumers & breaking risk |
| "Find unused/dead code" | \`api.findOrphanedCode()\` | Analyzes export/import relationships |
| "Show project structure" | \`api.getArchitectureOverview()\` | Aggregated metrics & module graph |
| "Find circular dependencies" | \`api.findCircularDependencies()\` | Graph analysis required |
| "What calls X?" / "Trace usage" | \`api.getCallGraph()\` | Function call relationships |
| "Check connection" / "Verify auth" | \`api.ping()\` | Lightweight auth check |

### Decision Logic for AI Assistants

**USE CONSTELLATION WHEN:**
1. User asks about symbol location → searchSymbols (not Glob)
2. User asks about dependencies/imports → getDependencies/getDependents
3. User asks about change impact → impactAnalysis
4. User asks about code quality → findOrphanedCode
5. User asks about project structure → getArchitectureOverview
6. User asks about connectivity/auth → ping

**FALLBACK TO OTHER TOOLS WHEN:**
- Need to **read source code** → Use \`Read\` tool (Constellation has no source)
- Need to **modify files** → Use \`Edit\`/\`Write\` tools
- **Simple text search** → Use \`Grep\` (no symbol analysis needed)
- **Project not indexed** → Inform user to run \`constellation index\`

### Capability Check Pattern

First call in a session can verify indexing:
\`\`\`javascript
const caps = await api.getCapabilities();
if (!caps.isIndexed) {
  return { error: "Project not indexed", suggestion: "Run: constellation index" };
}
\`\`\`

## How Code Mode Works

Constellation exposes ONE tool: \`execute_code\`. Write JavaScript code that uses the \`api\` object to call methods.

\`\`\`javascript
// Example: Find a function and analyze its impact
const search = await api.searchSymbols({ query: "handleAuth" });
const impact = await api.impactAnalysis({ symbolId: search.symbols[0].id });
return { search, impact };
\`\`\`

### Key Principles

1. **Always use \`await\`** - All API methods are async
2. **Always \`return\` results** - Otherwise output is undefined
3. **Use \`Promise.all()\`** - For parallel operations (3-10x faster)
4. **Use symbolId from search results** - More precise than name+path
5. **No comments in code** - Comments waste tokens and serve no purpose at runtime

### Discovery Pattern

When uncertain which method to use, start with \`api.listMethods()\`:
\`\`\`javascript
const guide = api.listMethods();
// Returns: methods[], decisionGuide, compositionPatterns[]
return guide;
\`\`\`

This returns method metadata, intent-to-method mapping, and composition recipes.

## Core Principle

**Constellation = Code Metadata & Relationships | Read tool = Source Code**

Constellation tells you ABOUT code (structure, dependencies, usage). Always use \`Read\` to view actual file contents.

## When to Use Constellation (Proactive)

Use \`execute_code\` **automatically** when the user asks:

**Discovery**: "Where is X?", "Find function Y", "Show me all classes"
\`\`\`javascript
const result = await api.searchSymbols({ query: "UserService", filterByKind: ["class"] });
return result.symbols.map(s => ({ name: s.name, file: s.filePath, line: s.line }));
\`\`\`

**Dependencies**: "What does X import?", "What uses X?", "Show call graph"
\`\`\`javascript
const [deps, dependents] = await Promise.all([
  api.getDependencies({ filePath: "src/service.ts" }),
  api.getDependents({ filePath: "src/service.ts" })
]);
return { imports: deps.directDependencies, usedBy: dependents.directDependents };
\`\`\`

**Impact Analysis**: "What breaks if I change X?", "Is it safe to delete?", "Show blast radius"
\`\`\`javascript
const impact = await api.impactAnalysis({ symbolName: "processOrder", filePath: "src/orders.ts" });
return { risk: impact.breakingChangeRisk, files: impact.impactedFiles };
\`\`\`

**Architecture**: "How is this organized?", "Show me the structure"
\`\`\`javascript
return await api.getArchitectureOverview({ includeMetrics: true });
\`\`\`

**Code Quality**: "Find dead code", "What can I delete?"
\`\`\`javascript
return await api.findOrphanedCode({ filePattern: "src/**", limit: 20 });
\`\`\`

## When NOT to Use Constellation

- **Reading source code** - Use \`Read\` tool
- **Modifying files** - Use \`Edit\` or \`Write\`
- **Running commands** - Use \`Bash\`
- **Project not indexed** - Ask user to run \`constellation index\`
- **Simple file patterns** - Use \`Glob\`
- **Text search** - Use \`Grep\`

## API Reference

| Method | Parameters | Use When |
|--------|------------|----------|
| \`api.searchSymbols()\` | query, filterByKind?, limit? | Finding functions, classes, variables |
| \`api.getSymbolDetails()\` | symbolId OR symbolName+filePath | Getting full symbol info |
| \`api.getDependencies()\` | filePath, depth? | What does this file import? |
| \`api.getDependents()\` | filePath, depth? | What imports this file? |
| \`api.traceSymbolUsage()\` | symbolId OR symbolName+filePath | Where is this symbol used? |
| \`api.getCallGraph()\` | symbolId OR symbolName+filePath, direction? | Function call relationships |
| \`api.impactAnalysis()\` | symbolId OR symbolName+filePath | Change impact assessment |
| \`api.findCircularDependencies()\` | filePath?, maxDepth? | Find import cycles |
| \`api.findOrphanedCode()\` | filePattern?, filterByKind? | Find unused/dead code |
| \`api.getArchitectureOverview()\` | includeMetrics? | High-level project structure |
| \`api.ping()\` | (none) | Verify authentication and API connectivity |

## Full Type Definitions

For complete TypeScript interface definitions of all API methods, read the resource:
\`\`\`
constellation://types/api
\`\`\`

Use this when you need exact property names, optional fields, or nested structures.

## Common Patterns

### Chained Analysis (Search -> Details -> Impact)
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

## Composite Workflows

**Why Code Mode is Powerful**: A single \`execute_code\` call can replace 6+ traditional MCP tool calls with deterministic results.

Traditional MCP tools would require separate calls for search, details, usage, dependencies, dependents, and impact analysis. The AI then synthesizes results non-deterministically. With Code Mode, you compose everything in one execution with custom logic.

### Comprehensive Symbol Analysis Pattern

\`\`\`javascript
const symbolName = "UserService";

// Step 1: Find the symbol
const search = await api.searchSymbols({ query: symbolName, limit: 1 });
if (search.symbols.length === 0) {
  return { error: \`Symbol "\${symbolName}" not found\` };
}
const symbol = search.symbols[0];

// Step 2: Parallel analysis (5 API calls in one round-trip)
const [details, usage, deps, dependents, impact] = await Promise.all([
  api.getSymbolDetails({ symbolId: symbol.id, includeRelationships: true }),
  api.traceSymbolUsage({ symbolId: symbol.id, excludeTests: true }),
  api.getDependencies({ filePath: symbol.filePath, depth: 2 }),
  api.getDependents({ filePath: symbol.filePath, depth: 2 }),
  api.impactAnalysis({ symbolId: symbol.id, analyzeBreakingChanges: true })
]);

// Step 3: Custom risk calculation (deterministic)
const usageCount = usage.directUsages?.length || 0;
const dependentCount = dependents.directDependents?.length || 0;
let riskLevel = "LOW";
if (usageCount > 50 || dependentCount > 20) riskLevel = "HIGH";
else if (usageCount > 20 || dependentCount > 10) riskLevel = "MEDIUM";

return {
  symbol,
  metrics: { usageCount, dependencyCount: deps.directDependencies?.length || 0, dependentCount, riskLevel },
  relationships: details.relationships,
  impact: impact.summary,
  breakingChangeRisk: impact.breakingChangeRisk
};
\`\`\`

**Result**: 6 operations + custom logic in ONE tool call. Traditional tools would require 6 calls plus non-deterministic AI synthesis.

## Best Practices

### Start Small, Escalate
- Use \`depth=1\` first, increase only if needed
- Depth grows **EXPONENTIALLY**: depth=1~10 files, depth=2~100 files, depth=3~1000+ files

### Use symbolId
- After \`searchSymbols\`, use returned \`symbolId\` in follow-up calls
- SymbolIds are precise, fast, and avoid ambiguity

### Parallel Execution
- Use \`Promise.all()\` for independent queries (3-10x faster)
- Check array lengths before accessing elements

### Filter Appropriately
- Set \`excludeTests=true\` for production-only impact analysis
- Use \`includeReferences\` only when needed (can be large for popular symbols)

## Semantic Markers in Results

| Marker | Meaning |
|--------|---------|
| [EXPORTED] | Public symbol - changes affect consumers |
| [INTERNAL] | Private - safe to change within module |
| [TEST] | Test file - lower production risk |
| [UNUSED] | Never imported - deletion candidate |
| [HEAVILY_USED] | 20+ usages - high impact |
| [HIGH_IMPACT] | Critical to many dependents |

## Quick Decision Matrix

| Need to... | Do this |
|------------|---------|
| Find where X is defined | \`searchSymbols\` + \`getSymbolDetails\` |
| Understand a file | Use \`Read\` tool |
| See what X depends on | \`getDependencies\` |
| See what depends on X | \`getDependents\` or \`impactAnalysis\` |
| Check if safe to change X | \`impactAnalysis\` (depth=1-2) |
| Plan refactoring | \`impactAnalysis\` + \`traceSymbolUsage\` |
| Understand architecture | \`getArchitectureOverview\` |
| Find dead code | \`findOrphanedCode\` |
| Debug circular imports | \`findCircularDependencies\` |
| Check connectivity | \`ping\` |

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
