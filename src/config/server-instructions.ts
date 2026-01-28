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
The \`query_code_graph\` tool is designed for YOU, the coding LLM, as your primary tool for understanding code structure. When you think "where is X defined?", "what calls this?", or "what would break?"—that's your cue to use \`query_code_graph\`, not Grep/Glob/Read.

When \`ping()\` succeeds, the code graph contains complete structural data for all indexed files — every symbol, dependency, and call relationship. For structural questions, it is MORE reliable than Grep: it captures indirect references and relationships that text search misses. Grep approximates; the graph knows.

Decision rule: When you consider using Grep/Glob calls to understand code structure, use \`query_code_graph\` instead—it answers structural questions in one call.

Use \`query_code_graph\` for: symbols, definitions, dependencies, usage, impact, architecture
Use Grep/Glob for: literal strings, log messages, config values, file patterns
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

## Rules
0. **Check availability first** — Run \`await api.ping()\` once per session to verify auth + connectivity. If it fails, fall back to Grep/Glob.
1. **Always await** - All api.* methods are async
2. **Return results** - Last expression auto-returned; use explicit \`return\` for control flow
3. **Use Promise.all()** - 3-10x faster for independent queries
4. **Use symbolId** - After search, use the returned \`id\` for precise follow-up queries
5. **Errors are structured** — Failed queries return \`{error: {code, message, guidance[]}}\`, not exceptions. Empty results return empty arrays, not errors. Read \`guidance[]\` for recovery steps. If a search returns empty, try a broader query before falling back to Grep.
6. **Check availability** — If unsure the project is indexed, run \`api.ping()\` or \`api.getCapabilities()\` first.

## Method Reference
| Method | Use For | Returns |
|--------|---------|---------|
| \`searchSymbols({query})\` | Find symbols by name | \`{symbols: [{id, name, kind, filePath, line}]}\` |
| \`getSymbolDetails({symbolId})\` | Full symbol info | \`{symbol: {id, name, signature, modifiers}, relationships}\` |
| \`getDependencies({filePath})\` | What this file imports | \`{directDependencies: [{filePath, importedSymbols}]}\` |
| \`getDependents({filePath})\` | What imports this file | \`{directDependents: [{filePath, usedSymbols}]}\` |
| \`impactAnalysis({symbolId})\` | Change risk assessment | \`{breakingChangeRisk: {riskLevel}, impactedFiles[], summary}\` |
| \`findOrphanedCode()\` | Find unused exports | \`{orphanedSymbols: [{name, kind, filePath}]}\` |
| \`getArchitectureOverview()\` | Project structure | \`{metadata, structure, dependencies, metrics}\` |
| \`traceSymbolUsage({symbolId})\` | All usages of symbol | \`{directUsages: [{filePath, usageType, line}]}\` |
| \`getCallGraph({symbolId})\` | Call relationships | \`{root, callers: [{name, filePath}], callees}\` |
| \`findCircularDependencies()\` | Import cycles | \`{cycles: [{cycle: [filePaths], length}]}\` |
| \`ping()\` | Verify auth + connectivity | \`{pong: boolean}\` |
| \`getCapabilities()\` | Check project indexing status | \`{indexed, languages, symbolCount}\` |

Run \`api.listMethods()\` for full API details. Read \`constellation://types/api/{method}\` for detailed type definitions.

## Recipes
\`\`\`javascript
// Find where a symbol is defined
return await api.searchSymbols({ query: "MyService" });

// Who calls this function?
const {symbols} = await api.searchSymbols({ query: "handleAuth" });
return await api.getCallGraph({ symbolId: symbols[0].id });

// What would break if I change this?
const {symbols} = await api.searchSymbols({ query: "UserService" });
return await api.impactAnalysis({ symbolId: symbols[0].id });

// File dependency tree
return await api.getDependencies({ filePath: "src/services/auth.ts" });

// Find unused code
return await api.findOrphanedCode();
\`\`\`

## Multi-Project Workspaces
Each distinct project must have a \`constellation.json\` file in it's root folder.
Provide \`cwd\` parameter to target the correct project in monorepos:
\`\`\`javascript
// Tool call with cwd parameter
query_code_graph({ code: 'return await api.searchSymbols({query:"User"})', cwd: "/path/to/project" })
\`\`\`
`.trim();
}
