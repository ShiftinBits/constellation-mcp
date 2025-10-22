# Constellation MCP Server

<img src="https://img.shields.io/badge/mcp-@constellationdev/mcp-lightgray.svg?logo=modelcontextprotocol" alt="MCP Server">
<a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL-blue.svg" alt="License"></a>

**Status: Complete - All 22 Tools Implemented** ✅
**Progress: 22/22 tools implemented** (100% complete)

AI-optimized MCP server providing 22 code intelligence tools for AI assistants like Claude Code. Built on proven infrastructure from `@constellation-cli` with automatic configuration and git-based project detection.

## Quick Start

### Installation

```bash
cd constellation-mcp
npm install
npm run build
```

### Configuration

1. **Set environment variable** (required):
```bash
export CONSTELLATION_API_KEY="your-api-key-here"
```

2. **Add to Claude Desktop config**:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "constellation": {
      "command": "node",
      "args": ["/absolute/path/to/constellation-mcp/dist/index.js"],
      "env": {
        "CONSTELLATION_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

3. **Optional: Create constellation.json in your project**:
```json
{
  "apiUrl": "http://localhost:3000",
  "branch": "main",
  "namespace": "my-project",
  "languages": {
    "typescript": { "fileExtensions": [".ts", ".tsx"] },
    "javascript": { "fileExtensions": [".js", ".jsx"] }
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  AI Assistant (Claude Code, etc.)                       │
└────────────────────┬────────────────────────────────────┘
                     │ MCP Protocol (STDIO)
┌────────────────────▼────────────────────────────────────┐
│  Constellation MCP Server (@constellation-mcp/)          │
│  ├─ Config Manager (auto-detect git project/branch)     │
│  ├─ ConstellationClient (HTTP with retry/auth)          │
│  ├─ 22 MCP Tools (BaseMcpTool → API → formatted output)│
│  └─ Error Mapper (helpful messages with guidance)       │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────────┐
│  Constellation API (@constellation-core/apps/client-api/)│
│  ├─ MCP Tool Executors (business logic)                 │
│  ├─ Neo4j Graph Engine (code intelligence)              │
│  └─ Redis Cache (fast repeated queries)                 │
└──────────────────────────────────────────────────────────┘
```

## Features

### ✅ Implemented Foundation

1. **HTTP Client** - Adapted from battle-tested CLI client with retry logic
2. **Config Manager** - Auto-loads config + environment variable overrides
3. **Git Auto-Detection** - Detects project ID from git remote, branch from current branch
4. **Base Tool Class** - Abstract base for all 22 tools with error handling
5. **Response Formatter** - AI-friendly text output (not raw JSON)
6. **Error Mapper** - Helpful messages with actionable guidance
7. **Type Safety** - TypeScript interfaces mirroring API DTOs

### Tool Catalog (22 Total)

#### Discovery Tools (4) - ✅ 4/4 complete
- ✅ **search_symbols** - Find functions/classes/variables
- ✅ **search_files** - Find files by pattern
- ✅ **get_symbol_details** - Deep dive into specific symbol
- ✅ **get_file_details** - File metadata + dependencies

#### Dependency Tools (5) - ✅ 5/5 complete
- ✅ **get_dependencies** - What does X depend on?
- ✅ **get_dependents** - What depends on X?
- ✅ **find_circular_dependencies** - Detect cycles
- ✅ **trace_symbol_usage** - Track symbol usage
- ✅ **get_call_graph** - Function invocation map

#### Impact Analysis Tools (4) - ✅ 4/4 complete
- ✅ **analyze_change_impact** - What breaks if I change this?
- ✅ **analyze_breaking_changes** - API contract violations
- ✅ **impact_analysis** - Comprehensive change analysis
- ✅ **find_orphaned_code** - Dead code detection

#### Architecture Tools (5) - ✅ 5/5 complete
- ✅ **get_architecture_overview** - High-level system view
- ✅ **get_module_overview** - Module structure
- ✅ **detect_architecture_violations** - Pattern violations
- ✅ **analyze_package_usage** - External dependencies
- ✅ **compare_modules** - Module comparison

#### Refactoring Tools (4) - ✅ 4/4 complete
- ✅ **find_similar_patterns** - Duplicate/similar code
- ✅ **find_entry_points** - Main execution paths
- ✅ **get_inheritance_hierarchy** - Class hierarchies
- ✅ **contextual_symbol_resolution** - Full context resolution

## Implementation Guide

### Adding a New Tool

See `src/tools/discovery/SearchSymbolsTool.ts` for complete example.

**Template**:
```typescript
import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { YourParams, YourResult } from '../../types/api-types.js';

class YourTool extends BaseMcpTool<YourParams, YourResult> {
  name = 'your_tool_name';
  description = 'What this tool does...';

  schema = {
    param1: {
      type: z.string().min(1),
      description: 'Parameter description',
    },
    // ... more parameters
  };

  protected formatResult(data: YourResult, metadata: any): string {
    // Format data for AI-friendly output
    return `Formatted output: ${JSON.stringify(data, null, 2)}`;
  }
}

export default YourTool;
```

**Steps**:
1. Create tool file in appropriate category folder
2. Extend `BaseMcpTool<InputType, OutputType>`
3. Define `name`, `description`, and Zod `schema`
4. Override `formatResult()` for custom formatting
5. Add types to `src/types/api-types.ts` if needed
6. Register in `src/index.ts`

## Development

### Build
```bash
npm run build
```

### Run (STDIO mode)
```bash
npm start
```

### Debug with MCP Inspector
```bash
npm run inspector
# Opens web interface for testing tools
```

### Watch mode
```bash
npm run watch
```

## Configuration Options

### Environment Variables
- `CONSTELLATION_API_KEY` - **Required** - API authentication key
- `CONSTELLATION_API_URL` - Optional - API endpoint (default: http://localhost:3000)
- `CONSTELLATION_PROJECT_ID` - Optional - Override auto-detected project ID
- `CONSTELLATION_BRANCH` - Optional - Override auto-detected branch

### constellation.json (Project Root)
```json
{
  "apiUrl": "http://localhost:3000",
  "branch": "main",
  "namespace": "my-project",
  "languages": {
    "typescript": { "fileExtensions": [".ts", ".tsx"] },
    "javascript": { "fileExtensions": [".js", ".jsx"] },
    "python": { "fileExtensions": [".py"] }
  }
}
```

### Auto-Detection (Fallback)
- Project ID: from git remote URL (normalized)
- Branch: from current git branch
- API URL: defaults to http://localhost:3000

## File Structure

```
constellation-mcp/
├── src/
│   ├── index.ts                    # Server entry + initialization
│   ├── client/
│   │   ├── constellation-client.ts # HTTP client (from CLI)
│   │   └── error-mapper.ts         # Error → helpful messages
│   ├── config/
│   │   ├── config.ts               # Config types
│   │   ├── config.loader.ts        # Config file loading
│   │   └── config-manager.ts       # Singleton manager
│   ├── tools/
│   │   ├── base/
│   │   │   └── BaseMcpTool.ts     # Abstract base class
│   │   ├── discovery/              # 4 tools (1 complete)
│   │   ├── dependency/             # 5 tools (todo)
│   │   ├── impact/                 # 4 tools (todo)
│   │   ├── architecture/           # 5 tools (todo)
│   │   └── refactoring/            # 4 tools (todo)
│   ├── types/
│   │   └── api-types.ts            # TypeScript interfaces
│   └── utils/
│       ├── git-utils.ts            # Git auto-detection
│       └── format-helpers.ts       # Response formatting
├── package.json
├── tsconfig.json
└── README.md
```

## Error Handling

All tools automatically provide helpful error messages:

**Authentication Error**:
```
❌ Authentication Failed

Set CONSTELLATION_API_KEY environment variable.
Get your API key from your Constellation administrator.
```

**Project Not Indexed**:
```
❌ Project Not Indexed

Run 'constellation index' to parse your codebase first.

Project: github.com/user/repo
Branch: main
```

## Next Steps

1. ✅ Foundation infrastructure (complete)
2. ✅ All 22 tools implemented (complete)
3. ⏳ Integration testing with live API
4. ⏳ Production deployment and monitoring
5. ⏳ Performance optimization and caching strategies

## Resources

- **Example Tool**: `src/tools/discovery/SearchSymbolsTool.ts`
- **MCP Framework**: https://github.com/anthropics/mcp-framework
- **Constellation API**: See `constellation-core/apps/client-api/`

---

**Built for AI coders by AI coders** ❤️
