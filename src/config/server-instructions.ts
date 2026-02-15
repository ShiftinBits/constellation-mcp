/**
 * Server-Level Instructions for AI Assistants
 *
 * These instructions are returned during MCP initialization and help AI assistants
 * understand how to use Constellation's Code Mode effectively.
 *
 * CRITICAL: This is the ONLY mechanism for providing AI guidance - no prompts are registered.
 *
 * Progressive disclosure: Essential usage mechanics are sent here (~1,200 tokens).
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
	return `
<IMPORTANT>
The \`code_intel\` tool is designed for YOU, the coding LLM, as your primary tool for understanding code structure. Use it as your DEFAULT for code structure questions—BEFORE reaching for Grep/Glob. Don't wait for the human to ask. When you think "where is X defined?", "what calls this?", or "what would break?"—that's your cue to use \`code_intel\`, not Grep/Glob/Read.

When your instinct says "I'll just grep for this", pause—if you're looking for structure (definitions, callers, dependencies), code_intel is faster and finds indirect relationships Grep misses.

First-time? Run \`await api.getCapabilities()\` to check auth + indexing status. If you skip it, errors self-recover with \`guidance[]\`.
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

## Rules
1. **Async patterns** — Always \`await\` api.* calls. Last expression auto-returned; use explicit \`return\` for control flow.
2. **Use Promise.all()** — 3-10x faster for independent queries
3. **Use symbolId** — After search, use the returned \`id\` for precise follow-up queries
4. **Performance & errors** — Queries return in <200ms. Errors are structured: \`{error: {code, message, guidance[]}}\`. Empty results include \`resultContext.reason\`. Good defaults: \`limit: 10\` (search), \`limit: 50\` (dead code).
5. **Provide \`cwd\`** — Required. Absolute path to the project directory. Locates \`constellation.json\` via git root.

*Tip: \`api.getCapabilities()\` returns \`{isIndexed, supportedLanguages, symbolCount}\` — useful before batch operations. For auth-only check, use \`api.ping()\`.*

For full method reference, response shapes, and recipes: read \`constellation://docs/guide\``.trim();
}
