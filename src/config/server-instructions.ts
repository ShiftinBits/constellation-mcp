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
The \`query_code_graph\` tool is designed for YOU, the coding LLM, as your primary tool for understanding code structure. Use it PROACTIVELY—don't wait for the human to ask. When you think "where is X defined?", "what calls this?", or "what would break?"—that's your cue to use \`query_code_graph\`, not Grep/Glob/Read.

Decision rule: When you consider using Grep/Glob calls to understand code structure, use \`query_code_graph\` instead—it answers structural questions in one call that would take multiple text searches, and captures indirect references Grep misses.

Use \`query_code_graph\` for: symbols, definitions, dependencies, usage, impact, architecture
Use Grep/Glob for: literal strings, log messages, config values, file patterns

Optional pre-flight: \`await api.getCapabilities()\` checks auth + indexing status. If you skip it, errors self-recover with \`guidance[]\`.

| Task | Best Tool |
|------|-----------|
| Find where X is defined | query_code_graph |
| What calls function X? | query_code_graph |
| What breaks if I change X? | query_code_graph |
| Dependencies of a file | query_code_graph |
| Find dead/unused code | query_code_graph |
| Search for a literal string | Grep |
| Find config values or env vars | Grep |
| Read/view source code | Read |
| Find files by name pattern | Glob |

Typical workflow: query_code_graph to find → Read to view source → Edit to modify
</IMPORTANT>

# Constellation Code Mode

Write JavaScript with the \`api\` object to query the code intelligence graph.

## Quick Start
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

## Empty Results?
1. Check \`resultContext.reason\` — "no_matches" vs "branch_not_indexed"
2. If no_matches: broaden query (e.g., "Auth" instead of "AuthService")
3. If branch_not_indexed: run \`constellation index\`
4. If still empty: fall back to Grep (symbol may be dynamically generated)

## Rules
1. **Always await** - All api.* methods are async
2. **Return results** - Last expression auto-returned; use explicit \`return\` for control flow
3. **Use Promise.all()** - 3-10x faster for independent queries
4. **Use symbolId** - After search, use the returned \`id\` for precise follow-up queries
5. **Errors are structured** — Failed queries return \`{error: {code, message, guidance[]}}\`, not exceptions. Empty results return empty arrays with \`resultContext.reason\` ("no_matches" or "branch_not_indexed"). Read \`guidance[]\` for recovery. If empty, try a broader query before falling back to Grep.
6. **Performance** — Queries typically return in <200ms
7. **Limits** — Good defaults: \`limit: 10\` (search), \`limit: 50\` (dead code). Impact analysis needs no limit.

*Tip: \`api.getCapabilities()\` returns \`{isIndexed, supportedLanguages, symbolCount}\` — useful before batch operations. For auth-only check, use \`api.ping()\`.*

## Top 3 Workflow
1. \`searchSymbols({query})\` → find symbol → get \`id\`
2. \`impactAnalysis({symbolId})\` → change risk
3. \`getDependents({filePath})\` → what uses this

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

*Methods marked * accept either \`{symbolId}\` or \`{symbolName, filePath}\`. All methods also accept \`limit\` and \`offset\` for pagination. \`isExported\` maps to Core's \`filterByExported\` parameter.*

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

### "Find Dead Code" Workflow
\`\`\`javascript
const orphans = await api.findOrphanedCode();
return orphans.orphanedSymbols?.map(s => \`\${s.kind} \${s.name} in \${s.filePath}\`);
\`\`\`

## Recovery Patterns
Error shape: \`{success, error: {code, message, guidance[], suggestedCode?, alternativeApproach?, recoverable}}\`
- **Read \`guidance[]\` first** — contains exact recovery steps
- **Check \`suggestedCode\`** — copy-paste ready retry code
- **Check \`alternativeApproach\`** — suggests Grep/Glob when they fit better
- **\`recoverable: true\`** means user action can fix it; \`false\` means fall back to Grep/Glob

Common codes: \`AUTH_ERROR\` → run \`constellation auth\` | \`PROJECT_NOT_INDEXED\` → run \`constellation index\` | \`SYMBOL_NOT_FOUND\` → try broader search or Grep | \`EXECUTION_TIMEOUT\` → query too broad (add \`limit\`), reduce \`depth\`, or use more specific search term

## Multi-Project Workspaces
Default: Uses git root of the MCP server's startup directory. In monorepos with multiple \`constellation.json\` files, provide \`cwd\`:
\`\`\`javascript
// Tool call with cwd parameter
query_code_graph({ code: 'return await api.searchSymbols({query:"User"})', cwd: "/path/to/project" })
\`\`\`
`.trim();
}
