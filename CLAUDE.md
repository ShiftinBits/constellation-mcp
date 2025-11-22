# constellation-mcp

**Role**: Model Context Protocol server bridging AI assistants to constellation-core.
**See**: `../CLAUDE.md` for workspace architecture, `../ADR.md` for MCP rationale.

## Purpose

Provide 18 MCP tools for AI assistants → Query constellation-core:3000 → Return code intelligence.

## Architecture

```
AI Assistant → MCP Client → MCP Tools → HTTP POST → constellation-core:3000/api/v1/mcp/execute → Neo4j → Response
                  ↑
             BaseMcpTool
             ToolRegistry
```

## 18 MCP Tools

**Architecture** (4):

- `get-architecture-overview` - High-level project structure
- `detect-architecture-violations` - Pattern violations
- `get-module-overview` - Module details
- `compare-modules` - Module comparison

**Dependencies** (4):

- `get-dependencies` - Symbol dependencies
- `get-dependents` - What depends on symbol
- `find-circular-dependencies` - Circular refs
- `analyze-package-usage` - Package usage

**Discovery** (6):

- `search-symbols` - Find symbols by name/pattern
- `search-files` - Find files
- `get-symbol-details` - Symbol info
- `get-file-details` - File info
- `contextual-symbol-resolution` - Context-aware lookup
- `find-similar-patterns` - Pattern matching

**Impact** (4):

- `impact-analysis` - Change impact
- `trace-symbol-usage` - Symbol usage traces
- `get-call-graph` - Call relationships
- `find-entry-points` - Entry points

## Key Files

```
src/
├── tools/                      18 tool implementations
│   ├── architecture/           get-architecture-overview, etc.
│   ├── dependency/             get-dependencies, etc.
│   ├── discovery/              search-symbols, etc.
│   └── impact/                 impact-analysis, etc.
├── lib/
│   └── BaseMcpTool.ts         Base class for all tools
├── registry/
│   ├── ToolRegistry.ts        Tool registration + lookup
│   └── tool-definitions/      11 definition files
├── client/
│   ├── constellation-client.ts  HTTP client to Core
│   └── error-mapper.ts         Error translation
├── config/
│   ├── config-manager.ts      Env config management
│   └── config-loader.ts       Load + validate config
├── types/
│   └── api-types.ts           Mirrors Core DTOs (MANUAL sync)
└── index.ts                   MCP server entry point
```

## BaseMcpTool Pattern

**All tools extend BaseMcpTool**:

```typescript
// src/lib/BaseMcpTool.ts
export abstract class BaseMcpTool<TInput, TOutput> {
	abstract name: string;
	abstract description: string;
	abstract inputSchema: z.ZodSchema<TInput>;

	async execute(input: unknown): Promise<TOutput> {
		const validated = this.inputSchema.parse(input);
		return this.executeInternal(validated);
	}

	protected abstract executeInternal(input: TInput): Promise<TOutput>;
}
```

**Example Tool**:

```typescript
// src/tools/discovery/SearchSymbolsTool.ts
export class SearchSymbolsTool extends BaseMcpTool<
	SearchSymbolsInput,
	SearchSymbolsOutput
> {
	name = 'search-symbols';
	description = 'Search for symbols by name or pattern';
	inputSchema = searchSymbolsInputSchema;

	protected async executeInternal(
		input: SearchSymbolsInput,
	): Promise<SearchSymbolsOutput> {
		const response = await this.client.post('/mcp/execute', {
			tool: this.name,
			params: input,
		});
		return response.data;
	}
}
```

## Tool Registry Pattern

**Registration**:

```typescript
// src/registry/ToolRegistry.ts
export class ToolRegistry {
	private tools = new Map<string, BaseMcpTool<any, any>>();

	register(tool: BaseMcpTool<any, any>): void {
		this.tools.set(tool.name, tool);
	}

	get(name: string): BaseMcpTool<any, any> | undefined {
		return this.tools.get(name);
	}
}

// src/index.ts
const registry = new ToolRegistry();
registry.register(new SearchSymbolsTool());
registry.register(new GetSymbolDetailsTool());
// ... register all 18 tools
```

**Tool Definitions** (separate from implementation):

```typescript
// src/registry/tool-definitions/search-symbols.definition.ts
export const searchSymbolsDefinition = {
	name: 'search-symbols',
	description: 'Search for symbols by name or pattern',
	inputSchema: {
		type: 'object',
		properties: {
			query: { type: 'string' },
			types: { type: 'array', items: { type: 'string' } },
		},
		required: ['query'],
	},

	// Optional: Trigger phrases for organic tool selection (metadata only)
	triggerPhrases: [
		"find function X",
		"where is X",
		"show me all Y",
		"locate class X",
		// 3-20 phrases total (3-100 chars each)
	],
};
```

### Trigger Phrases (Optional Metadata)

The `triggerPhrases` field helps AI assistants match user queries to appropriate tools organically:

**Purpose**:
- Improves natural language tool selection
- Provides metadata for documentation generation
- Enables future intent-matching capabilities

**Rules**:
- **Optional field** - not required, but recommended for all tools
- **3-20 phrases** per tool (validated by Zod schema)
- **3-100 characters** per phrase
- **Not sent via MCP protocol** - metadata only, zero token cost
- **Natural language patterns** - how users actually ask questions

**Example (impact-analysis)**:
```typescript
triggerPhrases: [
	"what will break",
	"is it safe to change",
	"show blast radius",
	"impact of changing",
	"breaking change risk",
	"can I modify this safely",
	"what depends on this",
	"refactoring impact",
	"change impact analysis",
	"what's affected by this change",
]
```

**Where Used**:
1. Tool definitions (src/registry/tool-definitions/*.definition.ts)
2. Constellation guide prompt (includes trigger phrases for each tool)
3. Future: Intent-based tool selection algorithms

**Note**: These phrases are embedded in the constellation-guide prompt to help AI assistants recognize when to use each tool.

## Type Sync (MANUAL - CRITICAL)

**MCP types** (`src/types/api-types.ts`) must mirror Core DTOs:

```typescript
// Core: constellation-core/apps/client-api/src/mcp/dto/search-symbols.dto.ts
export interface SearchSymbolsParams {
	query: string;
	types?: string[];
}
export interface SearchSymbolsResult {
	symbols: SymbolInfo[];
}

// MCP: constellation-mcp/src/types/api-types.ts (MUST MATCH)
// Mirrors constellation-core/apps/client-api/src/mcp/dto/search-symbols.dto.ts
export interface SearchSymbolsParams {
	query: string;
	types?: string[];
}
export interface SearchSymbolsResult {
	symbols: SymbolInfo[];
}
```

**Every type needs sync comment**:

```typescript
// Mirrors constellation-core/apps/client-api/src/mcp/dto/{tool}.dto.ts
```

**Check sync** (see workspace CLAUDE.md Section 3).

## Constellation Client

**HTTP Client to Core**:

```typescript
// src/client/constellation-client.ts
export class ConstellationClient {
	private config: ConstellationConfig;
	private accessKey: string;

	async executeMcpTool<TParams, TResult>(
		toolName: string,
		parameters: TParams,
		context: { projectId: string; branchName: string }
	): Promise<McpToolResult<TResult>> {
		const response = await this.sendRequest(
			`mcp/tools/${toolName}`,
			{ parameters },
			'POST',
			{
				'x-project-id': context.projectId,
				'x-branch-name': context.branchName,
			}
		);
		return response.json();
	}

	private async sendRequest(
		path: string,
		data: any,
		method: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<Response> {
		const requestHeaders: Record<string, string> = {
			...additionalHeaders,
			'Content-Type': 'application/json; charset=utf-8',
			'Authorization': this.accessKey, // Direct key, no "Bearer" prefix
		};

		const url = `${this.config.apiUrl}/v1/${path}`;
		return fetch(url, {
			method,
			headers: requestHeaders,
			body: data ? JSON.stringify(data) : undefined,
		});
	}
}
```

**Error Mapping**:

```typescript
// src/client/error-mapper.ts
export function mapCoreError(error: CoreError): McpError {
	switch (error.code) {
		case 'AUTH_ERROR':
			return new McpAuthError(error.message);
		case 'VALIDATION_ERROR':
			return new McpValidationError(error.message);
		case 'NETWORK_ERROR':
			return new McpNetworkError(error.message);
		default:
			return new McpError(error.message);
	}
}
```

## Configuration

**Environment Variables** (required):

```bash
export CONSTELLATION_ACCESS_KEY=ak_00000000-...
export CONSTELLATION_API_URL=http://localhost:3000
```

**Config Manager**:

```typescript
// src/config/config-manager.ts
export class ConfigManager {
	private config: Config;

	load(): void {
		this.config = {
			apiUrl: process.env.CONSTELLATION_API_URL || 'http://localhost:3000',
			accessKey: process.env.CONSTELLATION_ACCESS_KEY || '',
		};

		if (!this.config.accessKey) {
			throw new Error('CONSTELLATION_ACCESS_KEY is required');
		}
	}
}
```

## Commands

**Development**:

```bash
npm run inspector              # MCP protocol inspector (test tools)
npm run build                  # Build TypeScript
npm run dev                    # Development mode
npm start                      # Start MCP server
```

**Testing**:

```bash
npm test                       # All tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage (90%+ required)
```

**MCP Inspector**:

```bash
npm run inspector
# Opens MCP inspector UI
# Test tool calls interactively
# Verify request/response formats
```

## MCP Protocol Integration

**Tool Call Flow**:

1. AI assistant calls MCP tool: `search-symbols({query: "foo"})`
2. MCP server receives request via stdin (JSON-RPC)
3. ToolRegistry looks up tool by name
4. Tool validates input with Zod schema
5. Tool calls ConstellationClient.post('/mcp/execute', {tool, params})
6. Core executes tool, queries Neo4j, returns result
7. MCP tool returns result to AI assistant via stdout

**JSON-RPC Format**:

```json
{
	"method": "tools/call",
	"params": {
		"name": "search-symbols",
		"arguments": { "query": "foo" }
	},
	"id": 1
}
```

## Error Handling

**Error Types**:

- `McpAuthError`: Invalid CONSTELLATION_ACCESS_KEY
- `McpValidationError`: Invalid tool parameters
- `McpNetworkError`: Cannot reach constellation-core
- `McpToolError`: Tool execution failure
- `McpError`: Generic error

**Error Response**:

```typescript
{
  "error": {
    "code": -32603,
    "message": "Symbol not found",
    "data": { "tool": "search-symbols", "query": "foo" }
  },
  "id": 1
}
```

## File Conventions

**Naming**:

```
{Name}Tool.ts              Tool implementations
{name}.definition.ts       Tool definitions (MCP protocol)
{name}.spec.ts             Tests (co-located)
```

**Imports**:

```typescript
✓ import { BaseMcpTool } from '../lib/BaseMcpTool';
✓ import { ConstellationClient } from '../client/constellation-client';
✗ import { X } from 'src/lib/X';  // No absolute from src/
```

## Key Patterns

**Code Style** (AI assistant optimized):

```typescript
✗ NEVER use emojis (❌, ✅, 🚀, etc.)
✗ NEVER use decorative characters (═══, ───, etc.)
✓ Clean, parsable output only
✓ Professional, technical tone
```

**Validation**: Zod everywhere

```typescript
const schema = z.object({
	query: z.string(),
	types: z.array(z.string()).optional(),
});
```

**Logging**: console.log/console.error (no winston in MCP)

**Error Codes**: See workspace CLAUDE.md

## Tool Categories

**Architecture Tools**: Project structure, patterns, violations
**Dependency Tools**: Dependencies, dependents, circular refs
**Discovery Tools**: Search, lookup, resolution
**Impact Tools**: Change impact, usage traces, call graphs

## Extended Docs

- `../CLAUDE.md` - Workspace architecture, type sync checklist
- `../TROUBLESHOOTING.md` - Error codes: AUTH_ERROR, VALIDATION_ERROR, NETWORK_ERROR
- `../COMMANDS.md` - Full MCP command reference, inspector usage
- `../ADR.md` - ADR-004 (MCP for Neo4j), ADR-009 (Zod validation)

## Testing Tools

**MCP Inspector**:

```bash
npm run inspector
# Interactive UI to test all 18 tools
# Validates request/response formats
# Checks protocol compliance
```

**Unit Tests**:

```typescript
// src/tools/discovery/SearchSymbolsTool.spec.ts
describe('SearchSymbolsTool', () => {
	it('should search symbols', async () => {
		const tool = new SearchSymbolsTool(mockClient);
		const result = await tool.execute({ query: 'foo' });
		expect(result.symbols).toBeDefined();
	});
});
```

**Coverage**: 90%+ required for all tools.
