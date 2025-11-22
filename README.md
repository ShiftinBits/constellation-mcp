# Constellation MCP Server

<img src="https://img.shields.io/badge/mcp-@constellationdev/mcp-lightgray.svg?logo=modelcontextprotocol" alt="MCP Server"> <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL-blue.svg" alt="License"></a>

**Your AI assistant's telescope to a bespoke constellation of code knowledge**

Give your AI coding assistant (Claude Code, Cursor, GitHub Copilot, Google Gemini) instant, intelligent access to your entire codebase's structure, dependencies, and relationships without sending any source code.

## Why Constellation?

When AI assistants work with code, they typically can only see the files you explicitly show them. Constellation changes this by providing **code intelligence as a service** - your assistant can instantly understand:

- Where any function, class, or variable is defined
- What depends on what (and what will break if you change it)
- Call graphs and execution flows
- Circular dependencies and architectural issues
- Dead code and refactoring opportunities

**The key difference**: All this intelligence comes from a pre-indexed graph database, not by reading your source code. This means:

✅ **Instant results** - Millisecond responses, not minutes of parsing
✅ **No source code transmission** - Only metadata and relationships, never your code
✅ **Team-wide consistency** - Everyone's assistant uses the same code intelligence
✅ **Always up-to-date** - Indexed automatically when code changes

## How It Works

```
Your Codebase → [Constellation CLI] → Index → [MCP Server] → Your AI Assistant
                  (parses locally)    (team-shared)    (this package)   (instant answers)
```

1. **Local Parsing**: The Constellation CLI parses your code locally.
2. **Secure Upload**: Only source metadata is uploaded, never source code
3. **Knowledge Graph**: Your team's code intelligence resides in a centralized bespoke knowledge graph
4. **MCP Tools**: This server provides specialized tools for utilizing that intelligence
5. **AI-Powered**: Your coding assistant uses these tools to understand your codebase

## Code Mode: A Revolutionary Approach

**This is a Code Mode-only MCP server.** Instead of providing 10+ individual tools that your AI assistant calls sequentially, we provide ONE powerful tool: `execute_code`. Your AI writes JavaScript code to interact with the Constellation API directly.

### Why Code Mode?

**Traditional MCP**: Each tool call requires a full round-trip through the AI
```
AI → Tool 1 → AI → Tool 2 → AI → Tool 3 → Result  (slow, 30+ seconds)
```

**Code Mode**: Write once, execute once
```
AI → Write Code → Execute → Result  (fast, 2-3 seconds)
```

### Quick Example

Your AI assistant can write code like this to analyze your codebase:

```javascript
// Find all exported classes and check their usage
const classes = await api.searchSymbols({
  filterByKind: ["class"],
  filterByExported: true,
  limit: 50
});

// Check usage in parallel
const usages = await Promise.all(
  classes.symbols.map(c =>
    api.traceSymbolUsage({
      symbolName: c.name,
      filePath: c.filePath
    })
  )
);

// Find unused exports
return classes.symbols
  .filter((c, i) => usages[i].totalUsages === 0)
  .map(c => ({ name: c.name, file: c.filePath }));
```

**Performance**: 10-15x faster for multi-step operations. Code is the native language of LLMs.

**📖 See [Code Mode Documentation](docs/code-mode/README.md) for comprehensive examples, patterns, and best practices.**

## Installation

### Claude Code

Add to `~/.claude.json` (macOS) or `%CURRENTUSER%/claude.json` (Windows):

```json
{
	"mcpServers": {
		"constellation": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "@constellationdev/mcp@latest"]
		}
	}
}
```

### Cursor / Cline / Continue

Add to your MCP configuration file:

```json
{
	"mcpServers": {
		"constellation": {
			"type": "stdio",
			"command": "npx",
			"args": ["-y", "@constellationdev/mcp@latest"]
		}
	}
}
```

### GitHub Copilot / VS Code

Configure through your IDE's MCP settings with the same parameters.

## Available Tools

Your AI assistant will automatically use these tools when appropriate. You don't need to invoke them directly.

### 🔍 Discovery & Search

- **search_symbols** - Find functions, classes, variables by name or pattern
- **get_symbol_details** - Complete information about a specific symbol

### 🔗 Dependency Analysis

- **get_dependencies** - What does this file/symbol import or use?
- **get_dependents** - What depends on this file/symbol? (critical for impact analysis)
- **get_call_graph** - Function invocation hierarchy (who calls what?)
- **trace_symbol_usage** - Every place a symbol is used across the codebase
- **find_circular_dependencies** - Detect import cycles and dependency loops

### 💥 Impact & Risk Assessment

- **impact_analysis** - Comprehensive change impact with risk scoring
- **find_orphaned_code** - Identify unused exports and dead code

### 🏗️ Architecture

- **get_architecture_overview** - High-level codebase structure and metrics

## Example Workflows

### "Is it safe to change this function?"

```
AI Assistant automatically:
1. get_symbol_details → Check signature and usage count
2. get_dependents → Find all dependent files
3. impact_analysis → Assess risk and provide recommendations
```

### "Find and fix circular dependencies"

```
AI Assistant automatically:
1. find_circular_dependencies → Detect cycles
2. get_dependencies → Understand dependency chains
3. Suggests refactoring approach
```

### "What does this file import?"

```
AI Assistant automatically:
1. get_dependencies → List imports and dependencies
2. Suggests which dependencies might need updating
```

## What Makes This Different?

### Traditional AI Assistant Approach

- ❌ Can only see files you show it
- ❌ No understanding of dependencies
- ❌ Can't assess impact of changes
- ❌ Slow to parse large codebases
- ❌ Inconsistent results across team

### With Constellation MCP

- ✅ Instant access to entire codebase structure
- ✅ Understands all dependencies and relationships
- ✅ Risk assessment before changes
- ✅ Sub-100ms responses (cached)
- ✅ Team shares same code intelligence

## Verification

After installation, your AI assistant should be able to answer questions like:

- "Where is the UserService class defined?"
- "What files depend on utils/helpers.ts?"
- "Show me all functions named 'calculate\*'"
- "Is it safe to delete this function?"
- "Find circular dependencies in the codebase"

If these work, you're all set!

## Troubleshooting

### "Authentication Failed"

**Problem**: `CONSTELLATION_ACCESS_KEY` not set or invalid

**Solutions**:

1. Use the CLI `constellation auth` command to automatically set the environment variable
2. Or manually set globally: `export CONSTELLATION_ACCESS_KEY="your-key"`
3. Verify the key is correct with your team admin

### "Project Not Indexed"

**Problem**: Your codebase hasn't been parsed and uploaded yet

**Solutions**:

1. If you have the Constellation CLI: `constellation index`
2. Otherwise, contact your team admin to index the project
3. Indexing happens automatically in CI/CD for most setups

### "Connection Error"

**Problem**: Cannot reach Constellation API

**Solutions**:

1. Check internet connectivity
2. Verify you can reach `api.constellationdev.io`
3. Check if a firewall/VPN is blocking access
4. Contact your team admin about network access

### Tools Not Appearing in AI Assistant

**Solutions**:

1. Restart your AI assistant/IDE
2. Check MCP logs for startup errors
3. Verify the `npx @constellationdev/mcp@latest` command runs successfully

## Privacy & Security

- **No source code transmission**: Only source metadata is sent to the constellation servers
- **Access control**: Access keys required for all requests
- **Branch isolation**: Each git branch maintains discrete code intelligence

## Support & Resources

- 📖 **Documentation**: [docs.constellationdev.io](https://docs.constellationdev.io)
- 🐛 **Issues**: [github.com/constellationdev/mcp/issues](https://github.com/constellationdev/mcp/issues)

## License

AGPL-3.0 - See [LICENSE](LICENSE) for details.
