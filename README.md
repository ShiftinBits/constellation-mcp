# Constellation MCP Server

<img src="https://img.shields.io/badge/mcp-@constellationdev/mcp-lightgray.svg?logo=modelcontextprotocol" alt="MCP Server"> <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL-blue.svg" alt="License"></a>

AI-powered code intelligence for your development workflow. Constellation provides powerful specialized tools that enable AI assistants to understand your codebase through advanced analysis.

## ✨ Enhanced Tool Definitions

**NEW**: All 20 tools now include rich, AI-friendly metadata:

- **Rich Descriptions**: 2-3 sentences explaining what, when, and why to use each tool
- **Concrete Examples**: Real-world parameter combinations (2-3 per tool)
- **Use Case Mapping**: Clear scenarios linking user intent to tool selection
- **Common Mistakes**: Guidance to avoid pitfalls
- **Performance Notes**: Optimization tips and timing expectations
- **Related Tools**: Suggestions for effective tool chaining

This enhancement helps AI agents like Claude Code make better decisions about which tools to use and how to use them effectively.

## Installation

### Claude Code

Add to your Claude Code configuration `mcpServers` section:

**macOS**: `~/.claude.json`
**Windows**: `%CURRENTUSER%/claude.json`

```json
{
	"mcpServers": {
		"constellation": {
			"type": "stdio",
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
  "type": "stdio",
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

All 20 tools include enhanced definitions with examples, use cases, and usage guidance.

### Discovery (4 tools)

- `search_symbols` - Find functions, classes, variables, and other code symbols (3 examples)
- `search_files` - Locate files by name pattern or path (3 examples)
- `get_symbol_details` - Get detailed information about a specific symbol (3 examples)
- `get_file_details` - Get file metadata, imports, exports, and dependencies (3 examples)

### Dependencies (5 tools)

- `get_dependencies` - What does this file/symbol depend on? (3 examples)
- `get_dependents` - What depends on this file/symbol? (3 examples)
- `find_circular_dependencies` - Detect circular dependency chains (3 examples)
- `trace_symbol_usage` - Track how a symbol is used across the codebase (3 examples)
- `get_call_graph` - Generate function call hierarchy (3 examples)

### Impact Analysis (2 tools)

- `impact_analysis` - Comprehensive change impact assessment (3 examples)
- `find_orphaned_code` - Identify unused or unreachable code (3 examples)

### Architecture (5 tools)

- `get_architecture_overview` - High-level system structure and patterns (3 examples)
- `get_module_overview` - Detailed module organization (2 examples)
- `detect_architecture_violations` - Find violations of architectural patterns (2 examples)
- `analyze_package_usage` - External dependency analysis (2 examples)
- `compare_modules` - Side-by-side module comparison (2 examples)

### Refactoring (4 tools)

- `find_similar_patterns` - Discover duplicate or similar code patterns (2 examples)
- `find_entry_points` - Identify main execution entry points (2 examples)
- `get_inheritance_hierarchy` - Explore class inheritance trees (2 examples)
- `contextual_symbol_resolution` - Resolve symbols with full context (2 examples)

> **For Developers**: See [docs/TOOL_DEFINITIONS_GUIDE.md](docs/TOOL_DEFINITIONS_GUIDE.md) for details on the enhanced definition system and how to create new tool definitions.

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
