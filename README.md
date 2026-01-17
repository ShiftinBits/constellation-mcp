# Constellation MCP Server

[![NPM Version](https://img.shields.io/npm/v/@constellationdev/mcp?logo=npm&logoColor=white)](https://www.npmjs.com/package/@constellationdev/mcp) [![Add to VS Code](https://img.shields.io/badge/add%20to-VS%20Code-teal.svg?logo=modelcontextprotocol)](https://vscode.dev/redirect/mcp/install?name=Constellation%20MCP&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40constellationdev%2Fmcp%22%5D%7D) [![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE) [![Made with Claude Code](https://img.shields.io/badge/made%20with%20Claude%20Code-D97757.svg?logo=claude&logoColor=white)](https://www.anthropic.com/claude-code)

**Connecting the stars in your code into intelligent patters**

Give your AI coding assistant instant, intelligent access to your entire codebase's structure, dependencies, and relationships without transmitting any source code. Constellation provides code intelligence as a service to AI coding assistant tools.

## Quick Start

Add the Constellation MCP server to your AI assistant project-level config (or system-level if your tooling doesn't support project-level configuration):

```json filename=".mcp.json"
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

> [!NOTE]  
> The above example is a generic format for the `.mcp.json` file used by some tools such as VSCode and Claude Code.
>
> For information on configuring other AI assistants see the [MCP Server > Installation doc](http://localhost:3123/docs/mcp/#installation).

For further instructions regarding authentication, project setup, and configuration refer to the [official docs](https://docs.constellationdev.io/docs/).

## How It Works

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#4A90E2', 'primaryTextColor': '#EEEEEE', 'primaryBorderColor': '#2B2C34', 'lineColor': '#4A90E2', 'secondaryColor': '#1F1F28', 'tertiaryColor': '#0B0C10', 'edgeLabelBackground': '#1F1F28' }}}%%
flowchart LR
    subgraph local["🔒 Your Environment"]
        direction TB
        code["📂 Source Code"]
        cli["⚙️ Constellation CLI"]
        ai["🤖 AI Coding Assistant"]
        mcp["🧩 Constellation MCP"]
        code --> cli
    end

    subgraph cloud["☁️ Constellation Service"]
        direction TB
        api["🔌  API"]
        graphdb[("🧠 Knowledge Graph")]
        api <--> graphdb
    end

    cli a1@-->|"Metadata Upload"| api
    ai <-->|"Tool Calls"| mcp
    mcp a2@<-->|"Queries"| api

    a1@{ animation: fast }
    a2@{ animation: fast }

    click cli "https://www.github.com/shiftinbits/constellation-cli" "Go to CLI project repository"
    click mcp "https://www.github.com/shiftinbits/constellation-mcp" "Go to MCP project repository"

    style local fill:#1F1F28
    style cloud fill:#1F1F28,stroke:#4A90E2
    style cli stroke:#4A90E2
    style mcp stroke:#4A90E2
    style api stroke:#4A90E2
    style graphdb stroke:#4A90E2
```

1. **Parse and Analyze**: The CLI tool analyzes source code in **_your_** environment, extracting structural metadata (functions, classes, variables, imports, calls, references, etc.)
2. **Upload**: Only the metadata is securely sent to Constellation, never raw source code
3. **Query**: AI assistants use the Constellation MCP tool to send complex queries, and get rapid answers derived from the knowledge graph

## Documentation

Find the full and comprehensive documentation at **[docs.constellationdev.io/docs/mcp/](https://docs.constellationdev.io/docs/mcp/)**

- [Installation & Setup](https://docs.constellationdev.io/docs/mcp/#installation) - Configure for Claude Code, Cursor, GitHub Copilot, and more
- [Tools Reference](https://docs.constellationdev.io/docs/mcp/tools) - Code Mode API and available methods
- [Troubleshooting](https://docs.constellationdev.io/docs/mcp/troubleshooting) - Common issues and solutions

## Privacy & Security

- **No source code transmission** - Only metadata and relationships
- **Access control** - API keys required for all requests
- **Branch isolation** - Each git branch maintains discrete code intelligence

For comprehensive information regarding privacy and security, see the [official Privacy & Security documentation](http://localhost:3123/docs/privacy).

## Support

- Documentation: [docs.constellationdev.io](https://docs.constellationdev.io)
- Report Issues: [GitHub Issues](https://github.com/shiftinbits/constellation-mcp/issues)

## License

AGPL-3.0 - See [LICENSE](LICENSE) for details.

Copyright © 2026 ShiftinBits Inc.
