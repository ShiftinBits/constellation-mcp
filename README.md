# Constellation MCP Server

MCP (Model Context Protocol) server for Constellation - providing AI assistants with instant access to shared code intelligence.

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to Claude Desktop config:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "constellation": {
      "command": "node",
      "args": ["/absolute/path/to/constellation-mcp/dist/index.js"]
    }
  }
}
```

## Development

```bash
npm run build    # Compile TypeScript
npm run dev      # Development mode with watch
```
