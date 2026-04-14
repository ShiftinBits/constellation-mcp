/**
 * Server-Level Instructions for AI Assistants
 *
 * These instructions are returned during MCP initialization and help AI assistants
 * understand how to use Constellation's Code Mode effectively.
 *
 * CRITICAL: This is the ONLY mechanism for providing AI guidance - no prompts are registered.
 *
 * Progressive disclosure: Essential usage mechanics are sent here (~800 tokens).
 * Reference material (method tables, response shapes, recipes) is available on-demand
 * via the constellation://docs/guide resource.
 */

/**
 * Get server instructions for AI assistants
 *
 * Returned via MCP initialize response. Focused on USAGE mechanics, not tool selection
 * (selection guidance is in the tool description itself).
 */
export function getServerInstructions(): string {
	return `<CRITICAL>
code_intel vs Grep decision rule: If the search pattern is a symbol name (function, method, class, variable), use code_intel — even if you already know the file.

Why: code_intel resolves cross-file relationships, transitive dependencies, and indirect usages that text search cannot detect.

Grep exceptions (literal strings only): error messages, config values, log text, comments. Never for symbol names.
</CRITICAL>

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

## Rules
1. **Async patterns** — Always \`await\` api.* calls. Last expression auto-returned; use explicit \`return\` for control flow.
2. **Use Promise.all()** — 3-10x faster for independent queries
3. **Errors** — Structured: \`{error: {code, message, guidance[]}}\`. Empty results include \`resultContext.reason\`.
4. **Defaults** — \`limit: 50\` (search and dead code).
5. **Source snippets** — Results include \`sourceSnippet\` for symbols with file+line references. No need to Read files after code_intel — the source context is already in the response.

*Tip: \`api.listMethods()\` for API reference, \`api.help("methodName")\` for inline types. \`api.getCapabilities()\` for pre-flight indexing status.*

For full method reference, response shapes, and recipes: read \`constellation://docs/guide\``.trim();
}
