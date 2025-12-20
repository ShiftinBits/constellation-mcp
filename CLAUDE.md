# constellation-mcp

**Role**: Model Context Protocol server bridging AI assistants to constellation-core.
**See**: `../CLAUDE.md` for workspace architecture, `../ADR.md` for MCP rationale.

## Purpose

Provide Code Mode MCP interface for AI assistants → Query constellation-core:3000 → Return code intelligence.

## Architecture

```
AI Assistant → MCP Client → execute_code tool → JavaScript sandbox → HTTP POST → constellation-core:3000/api/v1/mcp/execute → Neo4j → Response
                                    ↑
                              CodeModeSandbox
                              ConstellationClient
```

## Code Mode (Single Tool, 10 API Methods)

The MCP server exposes **one tool** (`execute_code`) that runs JavaScript code with access to an `api` object:

```javascript
// Example: Find a function and analyze its impact
const search = await api.searchSymbols({ query: 'handleAuth' });
const impact = await api.impactAnalysis({ symbolId: search.symbols[0].id });
return { search, impact };
```

### Available API Methods

**Discovery** (2):

- `searchSymbols` - Find symbols by name/pattern
- `getSymbolDetails` - Get detailed symbol info

**Dependencies** (3):

- `getDependencies` - What a file depends on
- `getDependents` - What depends on a file
- `findCircularDependencies` - Detect circular refs

**Tracing** (2):

- `traceSymbolUsage` - Find all symbol usages
- `getCallGraph` - Function call relationships

**Impact** (2):

- `impactAnalysis` - Assess change impact
- `findOrphanedCode` - Find unused/dead code

**Architecture** (1):

- `getArchitectureOverview` - High-level project structure

## Key Files

```
src/
├── index.ts                      MCP server entry point
├── tools/
│   └── execute-code-tool.ts      Single Code Mode tool
├── code-mode/
│   ├── sandbox.ts                JavaScript execution sandbox
│   └── runtime.ts                API runtime for sandbox
├── client/
│   ├── constellation-client.ts   HTTP client to Core
│   ├── error-factory.ts          Structured error creation
│   └── error-mapper.ts           Error translation
├── config/
│   ├── config-manager.ts         Env config management
│   └── config.loader.ts          Load + validate config
├── registry/
│   ├── ToolRegistry.ts           Tool metadata registry
│   └── tool-definitions/         11 definition files (metadata)
├── prompts/
│   └── constellation-guide-prompt.ts  AI assistant guide
├── types/
│   └── api-types.ts              Mirrors Core DTOs (MANUAL sync)
└── codegen/
    └── api-generator.ts          TypeScript type generation
```

## Code Mode Sandbox

**JavaScript Execution**:

```typescript
// src/code-mode/sandbox.ts
export class CodeModeSandbox {
	private client: ConstellationClient;

	async execute(code: string, options?: ExecuteOptions): Promise<ExecuteResult> {
		// Validate code
		const validation = this.validateCode(code);

		// Create sandboxed context with api object
		const context = this.createSandboxContext();

		// Execute with timeout
		const result = await this.runInSandbox(code, context, options?.timeout);

		return result;
	}

	private createSandboxContext() {
		return {
			api: {
				searchSymbols: (params) => this.client.executeMcpTool('search_symbols', params, this.context),
				getSymbolDetails: (params) => this.client.executeMcpTool('get_symbol_details', params, this.context),
				// ... all 10 API methods
			},
			console: { log: ..., error: ..., warn: ... },
			Promise,
			// No file system, no network, no dangerous globals
		};
	}
}
```

## Tool Registry Pattern

**Registration** (metadata only, not execution):

```typescript
// src/registry/ToolRegistry.ts
export class ToolRegistry {
	private tools = new Map<string, McpToolDefinition>();

	register(definition: McpToolDefinition): void {
		this.tools.set(definition.name, definition);
	}
}

// src/index.ts
const registry = getToolRegistry();
registry.registerMany(allToolDefinitions); // 11 definitions for metadata
registerExecuteCodeTool(server); // 1 actual MCP tool
```

**Tool Definitions** (metadata for AI guidance):

```typescript
// src/registry/tool-definitions/search-symbols.definition.ts
export const searchSymbolsDefinition: McpToolDefinition = {
	name: 'search_symbols',
	category: 'Discovery',
	description: 'Search for symbols by name or pattern',
	inputSchema: { ... },
	examples: [ ... ],
	triggerPhrases: [
		"find function X",
		"where is X",
		"show me all Y",
	],
};
```

## Type Sync (MANUAL - CRITICAL)

**MCP types** (`src/types/api-types.ts`) must mirror Core DTOs:

```typescript
// Core: constellation-core/apps/client-api/src/mcp/dto/search-symbols.dto.ts
export interface SearchSymbolsParams {
	query: string;
	types?: string[];
}

// MCP: constellation-mcp/src/types/api-types.ts (MUST MATCH)
// Mirrors constellation-core/apps/client-api/src/mcp/dto/search-symbols.dto.ts
export interface SearchSymbolsParams {
	query: string;
	types?: string[];
}
```

**Check sync** (see workspace CLAUDE.md Section 3).

## Constellation Client

**HTTP Client to Core**:

```typescript
// src/client/constellation-client.ts
export class ConstellationClient {
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

	private async sendRequest(...): Promise<Response> {
		const requestHeaders: Record<string, string> = {
			...additionalHeaders,
			'Content-Type': 'application/json; charset=utf-8',
			'Authorization': `Bearer ${this.accessKey}`,  // Bearer token format
		};
		// ...
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
const apiKey = process.env.CONSTELLATION_ACCESS_KEY || '';
if (!apiKey) {
	console.warn('[CONSTELLATION] Warning: CONSTELLATION_ACCESS_KEY not set');
}
```

## Commands

**Development**:

```bash
npm run inspector              # MCP protocol inspector
npm run build                  # Build TypeScript
npm run dev                    # Development mode
npm start                      # Start MCP server
```

**Testing**:

```bash
npm test                       # All tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage (70%+ required)
```

## MCP Protocol Integration

**Tool Call Flow**:

1. AI assistant calls: `execute_code({ code: "return await api.searchSymbols({query: 'foo'})" })`
2. MCP server receives request via stdin (JSON-RPC)
3. CodeModeSandbox validates and executes JavaScript
4. Sandbox api methods call ConstellationClient
5. ConstellationClient POSTs to constellation-core
6. Core executes tool, queries Neo4j, returns result
7. Sandbox returns result to AI assistant via stdout

**JSON-RPC Format**:

```json
{
	"method": "tools/call",
	"params": {
		"name": "execute_code",
		"arguments": {
			"code": "return await api.searchSymbols({ query: 'foo' })"
		}
	},
	"id": 1
}
```

## Error Handling

**Error Types**:

- `AuthenticationError`: Invalid CONSTELLATION_ACCESS_KEY
- `AuthorizationError`: Valid key, insufficient permissions
- `ToolNotFoundError`: Unknown tool name
- `ConfigurationError`: Missing or invalid config
- `TimeoutError`: Execution timeout exceeded

**Structured Error Response**:

```typescript
{
  success: false,
  error: {
    code: "SYMBOL_NOT_FOUND",
    type: "SymbolNotFoundError",
    message: "Symbol not found in the index",
    recoverable: true,
    guidance: [
      "Verify the symbol name is correct",
      "Use api.searchSymbols() to find the symbol"
    ],
    context: { projectId, branchName, apiMethod }
  }
}
```

## File Conventions

**Naming**:

```
{name}.definition.ts       Tool definitions (metadata)
{name}.test.ts             Tests
```

**Imports**:

```typescript
// Correct
import { ConstellationClient } from '../client/constellation-client.js';
import { getConfigContext } from '../config/config-manager.js';

// Incorrect
import { X } from 'src/lib/X'; // No absolute from src/
```

## Key Patterns

**Code Style** (AI assistant optimized):

```typescript
// NEVER use emojis or decorative characters
// Clean, parsable output only
// Professional, technical tone
```

**Validation**: Zod everywhere

```typescript
const schema = z.object({
	query: z.string(),
	types: z.array(z.string()).optional(),
});
```

**Logging**: console.error to stderr (MCP uses stdout for protocol)

## Extended Docs

- `../CLAUDE.md` - Workspace architecture, type sync checklist
- `../TROUBLESHOOTING.md` - Error codes: AUTH_ERROR, VALIDATION_ERROR, NETWORK_ERROR
- `../COMMANDS.md` - Full MCP command reference, inspector usage
- `../ADR.md` - ADR-004 (MCP for Neo4j), ADR-009 (Zod validation)
- `docs/code-mode/README.md` - Code Mode usage guide

## Testing

**MCP Inspector**:

```bash
npm run inspector
# Interactive UI to test execute_code tool
# Validates request/response formats
# Checks protocol compliance
```

**Unit Tests**:

```typescript
// test/unit/code-mode/sandbox.test.ts
describe('CodeModeSandbox', () => {
	it('should execute code and return result', async () => {
		const sandbox = new CodeModeSandbox(mockClient, mockContext);
		const result = await sandbox.execute('return 1 + 1');
		expect(result.success).toBe(true);
		expect(result.result).toBe(2);
	});
});
```

**Coverage**: 70%+ required for all modules.
