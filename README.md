# Constellation MCP Server

<img src="https://img.shields.io/badge/mcp-@constellationdev/mcp-lightgray.svg?logo=modelcontextprotocol" alt="MCP Server">
<a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL-blue.svg" alt="License"></a>

AI-powered code intelligence for your development workflow. Constellation provides powerful specialized tools that enable AI assistants to understand your codebase through advanced analysis.

## Installation

### Claude Code

Add to your Claude Code configuration `mcpServers` section:

**macOS**: `~/.claude.json`
**Windows**: `%CURRENTUSER%/claude.json`

```json
{
	"mcpServers": {
		"constellation": {
			"command": "npx",
			"args": ["-y", "@constellationdev/mcp@latest"],
			"env": {
				"CONSTELLATION_API_KEY": "your-api-key-here"
			}
		}
	}
}
```

### Cline / Continue / Other MCP-Compatible Tools

For tools using the Model Context Protocol, add to the proper section of your MCP configuration file:

```json
"constellation": {
  "command": "npx",
  "args": [
    "-y",
    "@constellationdev/mcp@latest"
  ],
  "env": {
    "CONSTELLATION_API_KEY": "your-api-key-here"
  }
}
```

## Configuration

### Prerequisites

You'll need a Constellation API key and access to a Constellation service instance. Contact your team administrator or visit [constellationdev.io](https://constellationdev.io) to get started.

### Environment Variables

Set your API key (required):

```bash
export CONSTELLATION_API_KEY="your-api-key-here"
```

This can also be provided in the MCP server configuration JSON in the `env` section.

## Available Tools

### Discovery (4 tools)

- `search_symbols` - Find functions, classes, variables, and other code symbols
- `search_files` - Locate files by name pattern or path
- `get_symbol_details` - Get detailed information about a specific symbol
- `get_file_details` - Get file metadata, imports, exports, and dependencies

### Dependencies (5 tools)

- `get_dependencies` - What does this file/symbol depend on?
- `get_dependents` - What depends on this file/symbol?
- `find_circular_dependencies` - Detect circular dependency chains
- `trace_symbol_usage` - Track how a symbol is used across the codebase
- `get_call_graph` - Generate function call hierarchy

### Impact Analysis (4 tools)

- `analyze_change_impact` - Understand the scope of a potential change
- `analyze_breaking_changes` - Detect API contract violations
- `impact_analysis` - Comprehensive change impact assessment
- `find_orphaned_code` - Identify unused or unreachable code

### Architecture (5 tools)

- `get_architecture_overview` - High-level system structure and patterns
- `get_module_overview` - Detailed module organization
- `detect_architecture_violations` - Find violations of architectural patterns
- `analyze_package_usage` - External dependency analysis
- `compare_modules` - Side-by-side module comparison

### Refactoring (4 tools)

- `find_similar_patterns` - Discover duplicate or similar code patterns
- `find_entry_points` - Identify main execution entry points
- `get_inheritance_hierarchy` - Explore class inheritance trees
- `contextual_symbol_resolution` - Resolve symbols with full context

## Troubleshooting

### Authentication Error

```
❌ Authentication Failed
Set CONSTELLATION_API_KEY environment variable.
```

**Solution**: Verify your API key is set correctly in environment variables or tool configuration.

### Project Not Indexed

```
❌ Project Not Indexed
Run 'constellation index' to parse your codebase first.
```

**Solution**: Your project needs to be indexed first. If you have the Constellation CLI installed:

```bash
constellation index
```

Otherwise, contact your team administrator.

### Connection Error

```
❌ Cannot connect to Constellation API
```

**Solution**: Confirm internet connectivity and DNS resolution to `api.constellationdev.io`.

## Support

- **Documentation**: [docs.constellationdev.io](https://docs.constellationdev.io)
- **Issues**: [github.com/constellationdev/mcp/issues](https://github.com/constellationdev/mcp/issues)

## License

AGPL-3.0 - See [LICENSE](LICENSE) for details.
