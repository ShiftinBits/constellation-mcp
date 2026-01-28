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
The \`query_code\` tool is designed for YOU, the coding LLM, as your primary tool for understanding code structure. Use it PROACTIVELY—don't wait for the human to ask. When you think "where is X defined?", "what calls this?", or "what would break?"—that's your cue to use \`query_code\`, not Grep/Glob/Read.
</IMPORTANT>

# Constellation Code Mode

Write JavaScript with the \`api\` object to query the code intelligence graph.

## Quick Start
\`\`\`javascript
const result = await api.searchSymbols({ query: "UserService" });
return result.symbols[0];
\`\`\`

## Rules
1. **Always await** - All api.* methods are async
2. **Return results** - Last expression auto-returned; use explicit \`return\` for control flow
3. **Use Promise.all()** - 3-10x faster for independent queries
4. **Use symbolId** - After search, use the returned \`id\` for precise follow-up queries

## Method Reference
| Method | Use For |
|--------|---------|
| \`searchSymbols({query})\` | Find symbols by name |
| \`getSymbolDetails({symbolId})\` | Full symbol info |
| \`getDependencies({filePath})\` | What this file imports |
| \`getDependents({filePath})\` | What imports this file |
| \`impactAnalysis({symbolId})\` | Change risk assessment |
| \`findOrphanedCode()\` | Find unused exports |
| \`getArchitectureOverview()\` | Project structure |
| \`traceSymbolUsage({symbolId})\` | All usages of symbol |
| \`getCallGraph({symbolId})\` | Call relationships |
| \`findCircularDependencies()\` | Import cycles |

Run \`api.listMethods()\` for full API details. Read \`constellation://types/api/{method}\` for type definitions.

## Multi-Project Workspaces
Provide \`cwd\` parameter to target the correct project in monorepos:
\`\`\`javascript
// Tool call with cwd parameter
query_code({ code: 'return await api.searchSymbols({query:"User"})', cwd: "/path/to/project" })
\`\`\`
`.trim();
}
