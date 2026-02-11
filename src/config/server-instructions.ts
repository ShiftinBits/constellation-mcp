/**
 * Server-Level Instructions for AI Assistants
 *
 * These instructions are returned during MCP initialization and help AI assistants
 * understand how to use Constellation's Code Mode effectively.
 *
 * CRITICAL: This is the ONLY mechanism for providing AI guidance - no prompts are registered.
 */

/**
 * Get server instructions for AI assistants
 *
 * Returned via MCP initialize response. Focused on USAGE mechanics, not tool selection
 * (selection guidance is in the tool description itself).
 */
export function getServerInstructions(): string {
	return `
<IMPORTANT>
The \`code_intel\` tool is designed for YOU, the coding LLM, as your primary tool for understanding code structure. Use it as your DEFAULT for code structure questions—BEFORE reaching for Grep/Glob. Don't wait for the human to ask. When you think "where is X defined?", "what calls this?", or "what would break?"—that's your cue to use \`code_intel\`, not Grep/Glob/Read.

When your instinct says "I'll just grep for this", pause—if you're looking for structure (definitions, callers, dependencies), code_intel is faster and finds indirect relationships Grep misses.

First-time? Run \`await api.getCapabilities()\` to check auth + indexing status. If you skip it, errors self-recover with \`guidance[]\`.

| Task | Best Tool |
|------|-----------|
| Find where X is defined | code_intel |
| What calls function X? | code_intel |
| What breaks if I change X? | code_intel |
| Dependencies of a file | code_intel |
| Find dead/unused code | code_intel |
| New to this codebase? | code_intel (getArchitectureOverview) |
| How does this code flow? | code_intel (getCallGraph) |
| What changed that could cause this bug? | code_intel (trace callers) |
| Search for a literal string | Grep |
| Find config values or env vars | Grep |
| Read/view source code | Read |
| Find files by name pattern | Glob |

DON'T use code_intel for:
- Searching for literal strings (error messages, log text) → Grep
- Finding task comments or annotations → Grep
- Looking up environment variables or config values → Grep
- Listing files by name pattern → Glob

WRONG TOOL SIGNAL: If you've run 3+ Grep calls trying to understand code structure (callers, dependencies, impact), STOP and switch to code_intel.

Typical workflow: code_intel to find → Read to view source → Edit to modify
</IMPORTANT>

# Constellation Code Mode

Write JavaScript with the \`api\` object to query the code intelligence graph.

## Quick Start
**Required:** Always set \`cwd\` to the target project directory path.

\`\`\`javascript
// Simple lookup
const result = await api.searchSymbols({ query: "UserService" });
return result.symbols[0]; // → {id, name, kind, filePath, line}

// Chained analysis — search, then parallel impact + dependents
const {symbols} = await api.searchSymbols({ query: "AuthService" });
const [impact, deps] = await Promise.all([
  api.impactAnalysis({ symbolId: symbols[0].id }),
  api.getDependents({ filePath: symbols[0].filePath })
]);
return { risk: impact.breakingChangeRisk, dependents: deps.directDependents };
\`\`\`

## Top 3 Workflow
1. \`searchSymbols({query})\` → find symbol → get \`id\`
2. \`impactAnalysis({symbolId})\` → change risk
3. \`getDependents({filePath})\` → what uses this

## Which Method?
| Question | Call |
|----------|------|
| "Where is X?" | \`searchSymbols({query: "X"})\` |
| "What does X call?" | \`getCallGraph({symbolId, direction: "callees"})\` |
| "What calls X?" | \`getCallGraph({symbolId, direction: "callers"})\` |
| "What does this file import?" | \`getDependencies({filePath})\` |
| "What imports this file?" | \`getDependents({filePath})\` |
| "What would break?" | \`impactAnalysis({symbolId})\` |
| "Find all usages" | \`traceSymbolUsage({symbolId})\` |
| "Dead code?" | \`findOrphanedCode()\` |
| "Project overview" | \`getArchitectureOverview()\` |

### "What uses X?" — Choosing the Right Method
Three methods answer "what uses X?" at different granularity:

| Granularity | Method | Best For |
|-------------|--------|----------|
| **File imports** | \`getDependents({filePath})\` | "Which files import this module?" — file-level coupling |
| **Call chain** | \`getCallGraph({symbolId, direction: "callers"})\` | "Which functions call this function?" — call hierarchy |
| **All usages** | \`traceSymbolUsage({symbolId})\` | "Every place this symbol appears" — imports, calls, type refs, inheritance |

**Not sure?** Start with \`traceSymbolUsage\` for comprehensive results. Narrow to \`getDependents\` for file-level or \`getCallGraph\` for call-chain only.

## Response Contract
\`\`\`javascript
// Success — symbols found
{ success: true, result: { symbols: [{id, name, kind, filePath}] }, asOfCommit: "abc123", lastIndexedAt: "2025-01-28T..." }

// Empty — no matches (not an error)
{ success: true, result: { symbols: [] }, asOfCommit: "abc123", lastIndexedAt: "2025-01-28T...", resultContext: { reason: "no_matches", branchIndexed: true } }
// → resultContext.reason tells you WHY it's empty: "no_matches" vs "branch_not_indexed"

// Error — structured with recovery guidance (key fields shown; full response includes type, recoverable, context)
{ success: false, error: { code: "AUTH_ERROR", message: "...", guidance: ["Check CONSTELLATION_ACCESS_KEY"] } }
\`\`\`

### Top 3 Method Response Shapes

\`searchSymbols\` — key fields in \`result.symbols[]\`:
\`\`\`javascript
{ id, name, qualifiedName, kind, filePath, line, isExported, signature? }
\`\`\`

\`impactAnalysis\` — key fields in \`result\`:
\`\`\`javascript
{
  symbol: { id, name, kind, filePath, line },
  directDependents: [{ id, name, kind, filePath, relationshipType, depth: 1 }],
  impactedFiles: [{ filePath, symbolCount, symbols: [{ id, name, kind, line }] }],
  breakingChangeRisk: { riskLevel: "low"|"medium"|"high"|"critical", factors: [...], recommendations: [...] },
  summary: { directDependentCount, transitiveDependentCount, impactedFileCount, maxDepth }
}
\`\`\`

\`getDependents\` — key fields in \`result\`:
\`\`\`javascript
{
  file: "src/services/auth.ts",
  directDependents: [{ filePath: "src/controllers/login.ts", usedSymbols: ["AuthService", "login"] }],
  transitiveDependents: [{ filePath: "src/app.ts", distance: 2, path: ["auth.ts", "login.ts", "app.ts"] }]
}
\`\`\`

## Empty Results?
1. Check \`resultContext.reason\` — "no_matches" vs "branch_not_indexed"
2. If no_matches: broaden query (e.g., "Auth" instead of "AuthService")
3. If branch_not_indexed: run \`constellation index\`
4. If still empty: fall back to Grep (symbol may be dynamically generated)

## Rules
1. **Async patterns** — Always \`await\` api.* calls. Last expression auto-returned; use explicit \`return\` for control flow.
2. **Use Promise.all()** — 3-10x faster for independent queries
3. **Use symbolId** — After search, use the returned \`id\` for precise follow-up queries
4. **Performance & errors** — Queries return in <200ms. Errors are structured: \`{error: {code, message, guidance[]}}\`. Empty results include \`resultContext.reason\`. Good defaults: \`limit: 10\` (search), \`limit: 50\` (dead code).
5. **Provide \`cwd\`** — Required. Absolute path to the project directory. Locates \`constellation.json\` via git root.

*Tip: \`api.getCapabilities()\` returns \`{isIndexed, supportedLanguages, symbolCount}\` — useful before batch operations. For auth-only check, use \`api.ping()\`.*

---

## Method Reference
| Method | Parameters | Use For | Returns |
|--------|-----------|---------|---------|
| \`searchSymbols\` | \`query\`, \`filterByKind?\`, \`isExported?\` | Find symbols by name (substring) | \`{symbols: [{id, name, kind, filePath, line}]}\` |
| \`getSymbolDetails\` | \`symbolId\`*, \`includeRelationships?\` | Full symbol info | \`{symbol: {id, name, signature, modifiers}, relationships}\` |
| \`getDependencies\` | \`filePath\`, \`depth?\`, \`includeSymbols?\` | What this file imports | \`{directDependencies: [{filePath, importedSymbols}]}\` |
| \`getDependents\` | \`filePath\`, \`depth?\`, \`includeSymbols?\` | What imports this file | \`{directDependents: [{filePath, usedSymbols}]}\` |
| \`impactAnalysis\` | \`symbolId\`*, \`depth?\` | Change risk assessment | \`{breakingChangeRisk: {riskLevel}, impactedFiles[], summary}\` |
| \`findOrphanedCode\` | \`filterByKind?\`, \`exportedOnly?\` | Find unused exports | \`{orphanedSymbols: [{name, kind, filePath}]}\` |
| \`getArchitectureOverview\` | \`includeMetrics?\` | Project structure | \`{metadata, structure, dependencies, metrics}\` |
| \`traceSymbolUsage\` | \`symbolId\`*, \`includeTransitive?\` | All usages of symbol | \`{directUsages: [{filePath, usageType, line}]}\` |
| \`getCallGraph\` | \`symbolId\`*, \`direction?\`, \`depth?\` | Call relationships | \`{root, callers: [{name, filePath}], callees}\` |
| \`findCircularDependencies\` | \`filePath?\`, \`maxCycleLength?\` | Import cycles | \`{cycles: [{files: [filePaths], length}]}\` |
| \`ping\` | _(none)_ | Verify auth + connectivity | \`{pong: true}\` |
| \`getCapabilities\` | _(none)_ | Pre-flight check — indexing status | \`{isIndexed, supportedLanguages, symbolCount}\` |

*Methods marked * accept either \`{symbolId}\` or \`{symbolName, filePath}\`. All methods also accept \`limit\` and \`offset\` for pagination.*

Run \`api.listMethods()\` for full API details. Read \`constellation://types/api/{method}\` for detailed type definitions.

## Recipes

### "Safe to Change?" Workflow
\`\`\`javascript
const {symbols} = await api.searchSymbols({ query: "processOrder" });
const [impact, usage] = await Promise.all([
  api.impactAnalysis({ symbolId: symbols[0].id }),
  api.traceSymbolUsage({ symbolId: symbols[0].id })
]);
return { risk: impact.breakingChangeRisk, usages: usage.directUsages?.length };
\`\`\`

### "Understand This Codebase" Workflow
\`\`\`javascript
const arch = await api.getArchitectureOverview();
return { structure: arch.structure, metrics: arch.metrics, languages: arch.metadata?.languages };
\`\`\`

## Recovery Patterns
Error shape: \`{success, error: {code, message, guidance[], suggestedCode?, alternativeApproach?, recoverable}}\`
- **Read \`guidance[]\` first** — contains exact recovery steps
- **Check \`suggestedCode\`** — copy-paste ready retry code
- **Check \`alternativeApproach\`** — suggests Grep/Glob when they fit better
- **\`recoverable: true\`** means user action can fix it; \`false\` means fall back to Grep/Glob

Common codes: \`AUTH_ERROR\` → run \`constellation auth\` | \`PROJECT_NOT_INDEXED\` → run \`constellation index\` | \`SYMBOL_NOT_FOUND\` → try broader search or Grep | \`EXECUTION_TIMEOUT\` → query too broad (add \`limit\`), reduce \`depth\`, or use more specific search term`.trim();
}
