/**
 * Code Mode Usage Guide
 *
 * On-demand reference material for AI assistants using Constellation Code Mode.
 * Served via MCP resource: constellation://docs/guide
 *
 * This content was extracted from server-instructions.ts to reduce the token cost
 * of eager initialization. AI assistants read this resource when they need method
 * details, response shapes, or composition recipes.
 */

/**
 * Get the full Code Mode usage guide.
 *
 * Contains: method reference, response shapes, recipes, recovery patterns,
 * and disambiguation guidance.
 */
export function getCodeModeGuide(): string {
	return `# Code Mode Usage Guide

Full reference for Constellation Code Mode API. Read this when writing \`code_intel\` queries.

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
