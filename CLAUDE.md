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
| Benchmark     | `npm run benchmark`                     |

**Engines**: Node.js 24+, npm 11+

## Architecture

```
AI Assistant → MCP (stdio) → query_code_graph → CodeModeSandbox → ConstellationClient → Core:3000 → Neo4j
```

**Single tool design**: One `query_code_graph` tool executes JavaScript with `api` object providing 13 methods (10 API + ping + getCapabilities + listMethods).

**Layer stack**:

| Layer   | File                             | Responsibility                                        |
| ------- | -------------------------------- | ----------------------------------------------------- |
| Tool    | `tools/query-code-graph-tool.ts` | Input validation, config resolution, error transform  |
| Runtime | `code-mode/runtime.ts`           | Orchestration, result formatting, size limits         |
| Sandbox | `code-mode/sandbox.ts`           | VM isolation, dual timeout, AST validation, API proxy |
| Client  | `client/constellation-client.ts` | HTTP with retry/backoff, auth headers                 |
| Config  | `config/config-cache.ts`         | Multi-project resolution, LRU cache by git root       |

## Key Files

```
src/
├── index.ts                            Entry point, registers tool + resources
├── tools/query-code-graph-tool.ts      MCP tool handler (input validation, error transform)
├── code-mode/
│   ├── sandbox.ts                      VM execution, dual timeout, API proxy
│   ├── runtime.ts                      Orchestration, result size enforcement
│   ├── auto-return.ts                  REPL-like implicit return (AST-based)
│   ├── capabilities.ts                 Project state detection
│   └── validators/
│       ├── ast-validator.ts            Acorn AST walker integration
│       ├── dangerous-patterns.ts       Pattern checker definitions
│       └── ast-walker.ts               Generic AST traversal
├── client/
│   ├── constellation-client.ts         HTTP client with retry/backoff
│   ├── error-factory.ts                Structured error creation (17 error codes)
│   └── error-mapper.ts                 Error message formatting
├── config/
│   ├── config-cache.ts                 Multi-project config resolution & LRU cache
│   ├── config.loader.ts                Load constellation.json from git root
│   ├── server-instructions.ts          AI assistant guidance (MCP instructions)
│   └── config.ts                       ConstellationConfig class
├── types/
│   ├── api-types.d.ts                  API method type definitions (mirror Core DTOs)
│   ├── mcp-errors.ts                   Error codes & structured error interfaces
│   ├── mcp-response.ts                 MCP response types
│   └── method-summaries.ts             Per-method type excerpts for resources
├── constants/
│   ├── sandbox-limits.ts               Execution timeouts, code size, API call limits
│   ├── result-limits.ts                Output size thresholds (100KB warn, 1MB hard)
│   ├── urls.ts                         Documentation URLs
│   └── index.ts                        Re-exports
└── utils/
    ├── file.utils.ts                   File/git root operations
    └── error-messages.ts               Error message templates
```

## API Methods (13 total)

| Method                     | Purpose                      | Type |
| -------------------------- | ---------------------------- | ---- |
| `searchSymbols`            | Find symbols by name/pattern | API  |
| `getSymbolDetails`         | Detailed symbol info         | API  |
| `getDependencies`          | What a file imports          | API  |
| `getDependents`            | What imports a file          | API  |
| `findCircularDependencies` | Detect import cycles         | API  |
| `traceSymbolUsage`         | Find all symbol usages       | API  |
| `getCallGraph`             | Function call relationships  | API  |
| `impactAnalysis`           | Assess change impact         | API  |
| `findOrphanedCode`         | Find unused/dead code        | API  |
| `getArchitectureOverview`  | Project structure overview   | API  |
| `ping`                     | Verify auth + connectivity   | Util |
| `getCapabilities`          | Check indexing status        | Util |
| `listMethods`              | Method discovery (sync)      | Util |

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

**Multi-project**: ConfigCache resolves config per git root via `cwd` parameter. LRU cached. Server starts without config (tools return setup instructions).

## Type Sync (CRITICAL)

`src/types/api-types.d.ts` must mirror Core DTOs. See `../CLAUDE.md` Section 3 for checklist.

**Shared types package**: `@constellationdev/types` (GitHub-sourced). Locally linked via `npm link` in dev, falls back to GitHub version in CI.

**Parameter transformation** (in `sandbox.ts`): MCP `isExported` → Core `filterByExported` (search_symbols only).

## Error Handling

**17 error codes** (from `mcp-errors.ts`):

| Category  | Codes                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| Auth      | `AUTH_ERROR`, `AUTHZ_ERROR`, `AUTH_EXPIRED`                                                                        |
| Config    | `NOT_CONFIGURED`, `API_UNREACHABLE`                                                                                |
| Project   | `PROJECT_NOT_INDEXED`, `BRANCH_NOT_FOUND`, `STALE_INDEX`                                                           |
| Execution | `SYMBOL_NOT_FOUND`, `FILE_NOT_FOUND`, `TOOL_NOT_FOUND`, `VALIDATION_ERROR`, `EXECUTION_TIMEOUT`, `EXECUTION_ERROR` |
| System    | `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`                                                            |

**Structured error response** includes: `code`, `type`, `message`, `recoverable`, `guidance[]`, `context`, `docs?`, `suggestedCode?`, `alternativeApproach?`.

**Retry logic** (`constellation-client.ts`): Exponential backoff (1s base, 2^n scaling, 250ms jitter, 30s cap). Retries on 5xx only. Default 3 attempts.

## Sandbox Behavior

**Dual timeout** (`sandbox.ts`): VM timeout catches sync hangs, `Promise.race` catches async hangs.

**Auto-return** (`auto-return.ts`): AST-based implicit `return` prepended to last expression. Handles destructuring, multi-declarator const. Falls back gracefully on parse errors.

**Rate limiting**: Max 50 API calls per execution (configurable via `maxApiCalls`).

**Code validation** (`validators/`): Acorn AST parser (not TypeScript compiler — faster) walks tree checking:

- **Dangerous globals**: `process`, `global`, `globalThis`, `require`, `module`, `exports`, `__dirname`, `__filename`, `Buffer`, `eval`, `Function`, `Proxy`, `Reflect`
- **Dangerous properties**: `constructor`, `__proto__`, `prototype`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`
- **Patterns**: Computed property chains, dynamic import(), with statements
- **Warnings**: Missing `return` or `await`

**Sandbox globals**: `api`, `Promise`, `Array`, `Object`, `String`, `Number`, `Boolean`, `Date`, `JSON`, `Math`, `RegExp`, `Map`, `Set`, `Function`, `console.*` — all frozen (prototypes + constructors).

**Limits** (`constants/sandbox-limits.ts`):

| Limit             | Value                              |
| ----------------- | ---------------------------------- |
| Default timeout   | 30s                                |
| Min/Max timeout   | 1s – 60s                           |
| Max code size     | 100KB                              |
| Max API calls     | 50                                 |
| Memory limit      | 128MB (best-effort, checked @50ms) |
| Result warn       | 100KB                              |
| Result hard limit | 1MB (truncated with preview)       |

## Testing

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # 70%+ required (branches, functions, lines, statements)
npm run test:ci             # CI mode (--maxWorkers=2)
npm run inspector           # Interactive MCP protocol validation
```

Test structure mirrors `src/`: `test/unit/{module}/{file}.test.ts`

**Coverage excludes**: `index.ts` (import.meta.url), type definitions, example tools.

## Gotchas

- **Logging**: Use `console.error` only (MCP uses stdout for protocol)
- **ESM imports**: Must include `.js` extension (`from './config.js'`)
- **Build tool**: `tsup` (ESM bundle, tree-shake, minify, keepNames) — not tsc directly
- **Windows**: `breakOnSigint` disabled on Windows (can cause hangs)
- **Result truncation**: Large results silently truncated at 1MB with preview
- **Config fallback**: Server starts even without config — tools return setup instructions
- **Auto-return**: Sandbox adds implicit `return` to last expression. Code with explicit `return` is unchanged
- **Prototype freeze**: All built-in prototypes and constructors are frozen in sandbox to prevent pollution

## Dependencies

| Package                     | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `@modelcontextprotocol/sdk` | MCP protocol implementation                                     |
| `@constellationdev/types`   | Shared type definitions (GitHub-sourced, mirrors Core DTOs)     |
| `acorn`                     | JS AST parser for code validation (fast, no TS compiler needed) |
| `zod`                       | Runtime schema validation                                       |

## Extended Docs

| Path                    | Content                           |
| ----------------------- | --------------------------------- |
| `../CLAUDE.md`          | Workspace architecture, type sync |
| `../TROUBLESHOOTING.md` | Error codes, debug commands       |
| `../COMMANDS.md`        | Full command reference            |
| `../ADR.md`             | Architecture decisions            |
