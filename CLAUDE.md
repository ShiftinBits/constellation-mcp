# constellation-mcp

MCP server bridging AI assistants to constellation-core for code intelligence.

**See**: `../CLAUDE.md` for workspace architecture, type sync checklist.

## Quick Reference

| Task          | Command                                 |
| ------------- | --------------------------------------- |
| Build         | `npm run build`                         |
| Dev watch     | `npm run watch`                         |
| Test          | `npm test`                              |
| Coverage      | `npm run test:coverage` (70%+ required) |
| Lint          | `npm run lint:fix`                      |
| MCP Inspector | `npm run inspector`                     |
| Type check    | `npm run type-check`                    |

**Engines**: Node.js 24+, npm 11+

## Architecture

```
AI Assistant → MCP (stdio) → execute_code → CodeModeSandbox → ConstellationClient → Core:3000 → Neo4j
```

**Single tool design**: One `execute_code` tool executes JavaScript with `api` object providing 12 methods.

## Key Files

```
src/
├── index.ts                     Entry point, registers tool + resource
├── tools/execute-code-tool.ts   MCP tool handler
├── code-mode/
│   ├── sandbox.ts               VM execution with dual timeout
│   ├── runtime.ts               API method metadata
│   └── capabilities.ts          Project state detection
├── client/
│   ├── constellation-client.ts  HTTP client with retry/backoff
│   ├── error-factory.ts         Structured error creation
│   └── error-mapper.ts          Error translation
├── config/
│   ├── config-manager.ts        Singleton config access
│   ├── config.loader.ts         Load constellation.json
│   └── config.ts                ConstellationConfig class
├── types/
│   ├── api-types.d.ts           API method type definitions (mirror Core DTOs)
│   └── mcp-errors.ts            Error codes & structured errors
└── registry/                    Tool metadata registry
```

## API Methods (12 total)

| Method                     | Purpose                      |
| -------------------------- | ---------------------------- |
| `searchSymbols`            | Find symbols by name/pattern |
| `getSymbolDetails`         | Detailed symbol info         |
| `getDependencies`          | What a file imports          |
| `getDependents`            | What imports a file          |
| `findCircularDependencies` | Detect import cycles         |
| `traceSymbolUsage`         | Find all symbol usages       |
| `getCallGraph`             | Function call relationships  |
| `impactAnalysis`           | Assess change impact         |
| `findOrphanedCode`         | Find unused/dead code        |
| `getArchitectureOverview`  | Project structure overview   |
| `ping`                     | Verify auth + connectivity   |
| `getCapabilities`          | Check indexing status        |

## Configuration

**Priority**: Env vars → `constellation.json` → Defaults

| Env Variable               | Purpose                       |
| -------------------------- | ----------------------------- |
| `CONSTELLATION_ACCESS_KEY` | API authentication (required) |
| `CONSTELLATION_API_URL`    | Override API endpoint         |
| `DEBUG`                    | Enable verbose logging        |

**Config file** (`constellation.json` at git root):

```json
{
  "apiUrl": "http://localhost:3000",
  "projectId": "...",
  "branch": "main",
  "languages": { "typescript": { "fileExtensions": [".ts", ".tsx"] } }
}
```

## Type Sync (CRITICAL)

`src/types/api-types.d.ts` must mirror Core DTOs. See `../CLAUDE.md` Section 3 for checklist.

**Parameter transformations** (in `sandbox.ts:440-453`):

- MCP `isExported` → Core `filterByExported`

## Error Handling

**Error codes** (from `mcp-errors.ts`):

| Category  | Codes                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| Auth      | `AUTH_ERROR`, `AUTHZ_ERROR`, `AUTH_EXPIRED`                                                     |
| Config    | `NOT_CONFIGURED`, `API_UNREACHABLE`                                                             |
| Project   | `PROJECT_NOT_INDEXED`, `BRANCH_NOT_FOUND`, `STALE_INDEX`                                        |
| Execution | `SYMBOL_NOT_FOUND`, `FILE_NOT_FOUND`, `TOOL_NOT_FOUND`, `VALIDATION_ERROR`, `EXECUTION_TIMEOUT` |
| System    | `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`                                         |

**Retry logic** (`constellation-client.ts:236-243`): Exponential backoff (1s, 2s, 4s...) with jitter, max 30s, for 5xx errors.

## Sandbox Behavior

**Dual timeout** (`sandbox.ts:199-220`):

1. VM timeout catches sync hangs
2. `Promise.race` catches async hangs

**Code validation** (`sandbox.ts:619-689`):

- Blocks dangerous patterns (require, eval, process, fs, etc.)
- Warns on missing `return` or `await` (common mistakes)

**Allowed in sandbox**: `api`, `Promise`, `Array`, `Object`, `String`, `Number`, `Boolean`, `Date`, `JSON`, `Math`, `RegExp`, `Map`, `Set`, `console.*`

## Testing

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # 70%+ required
npm run inspector           # Interactive MCP validation
```

Test structure mirrors `src/`: `test/unit/{module}/{file}.test.ts`

## Gotchas

- **Logging**: Use `console.error` (MCP uses stdout for protocol)
- **ESM imports**: Must include `.js` extension (`from './config.js'`)
- **Build tool**: Uses `tsup` (not tsc directly)
- **Windows**: `breakOnSigint` disabled on Windows (`sandbox.ts:213`)

## Extended Docs

| Path                       | Content                           |
| -------------------------- | --------------------------------- |
| `../CLAUDE.md`             | Workspace architecture, type sync |
| `../TROUBLESHOOTING.md`    | Error codes, debug commands       |
| `../COMMANDS.md`           | Full command reference            |
| `../ADR.md`                | Architecture decisions            |
| `docs/code-mode/README.md` | Code Mode usage guide             |
