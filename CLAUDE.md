# constellation-mcp

MCP server bridging AI assistants to constellation-core for code intelligence.

**See**: `../CLAUDE.md` for workspace architecture and shared types.

## Quick Reference

| Task          | Command                                 |
| ------------- | --------------------------------------- |
| Build + start | `npm start`                             |
| Build         | `npm run build`                         |
| Dev watch     | `npm run watch`                         |
| Test          | `npm test`                              |
| Coverage      | `npm run test:coverage` (70%+ required) |
| Lint          | `npm run lint:fix`                      |
| Lint (errors) | `npm run lint:errors` (no warnings)     |
| MCP Inspector | `npm run inspector`                     |
| Type check    | `npm run type-check`                    |
| Benchmark     | `npm run benchmark`                     |

**Engines**: Node.js 20+, npm 10+

## Architecture

```
AI Assistant → MCP (stdio) → code_intel → CodeModeSandbox → ConstellationClient → Core:3000 → Neo4j
```

**Single tool design**: One `code_intel` tool executes JavaScript with `api` object providing 14 methods (10 API + ping + getCapabilities + listMethods + help).

**Layer stack**:

| Layer   | File                             | Responsibility                                        |
| ------- | -------------------------------- | ----------------------------------------------------- |
| Tool    | `tools/query-code-graph-tool.ts` | Input validation, config resolution, error transform  |
| Runtime | `code-mode/runtime.ts`           | Orchestration, isolation selection, result formatting |
| Sandbox | `code-mode/sandbox.ts`           | VM isolation, dual timeout, AST validation, API proxy |
| Client  | `client/constellation-client.ts` | HTTP with retry/backoff, auth headers                 |
| Config  | `config/config-cache.ts`         | Multi-project resolution, LRU cache by git root       |

**Sandbox isolation levels** (SB-258):

| Aspect          | `CodeModeSandbox` (default)  | `IsolatedSandbox` (hardened)               |
| --------------- | ---------------------------- | ------------------------------------------ |
| Activation      | Default                      | `CONSTELLATION_SANDBOX_ISOLATION=hardened` |
| Execution       | VM (same process)            | Child process fork                         |
| Memory limit    | Periodic check (best-effort) | Hard limit via `--max-old-space-size`      |
| Timeout         | VM timeout + Promise.race    | SIGKILL (no escape)                        |
| Crash isolation | None (crashes MCP server)    | Child crash contained                      |

## Key Files

```
src/
├── index.ts                            Entry point, registers tool + 5 MCP resources
├── tools/query-code-graph-tool.ts      MCP tool handler (input validation, error transform)
├── code-mode/
│   ├── sandbox.ts                      VM execution, dual timeout, API proxy
│   ├── isolated-sandbox.ts             Child-process sandbox (hardened mode, SB-258)
│   ├── sandbox-worker.ts               Child process entry point for IsolatedSandbox
│   ├── worker-path.ts                  Worker path resolution (import.meta.url)
│   ├── runtime.ts                      Orchestration, isolation selection, result truncation
│   ├── auto-return.ts                  REPL-like implicit return (AST-based)
│   ├── capabilities.ts                 Project state detection
│   ├── source-enrichment.ts            Local source snippet injection (never sent to Core)
│   └── validators/
│       ├── index.ts                    Barrel exports
│       ├── ast-validator.ts            Acorn AST walker integration
│       ├── dangerous-patterns.ts       Pattern checker definitions
│       └── ast-walker.ts               Generic AST traversal
├── client/
│   ├── constellation-client.ts         HTTP client with retry/backoff
│   ├── error-factory.ts                Structured error creation (18 error codes)
│   └── error-mapper.ts                 Error message formatting
├── config/
│   ├── config-cache.ts                 Multi-project config resolution & LRU cache
│   ├── config.loader.ts                Load constellation.json from git root
│   ├── config.ts                       ConstellationConfig class
│   ├── server-instructions.ts          AI assistant guidance (MCP instructions)
│   └── code-mode-guide.ts             On-demand reference material (MCP resource)
├── types/
│   ├── api-types.d.ts                  Re-exports from @shiftinbits/constellation-types
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
    ├── error-messages.ts               Error message templates
    ├── metrics.ts                      In-memory execution metrics (singleton)
    └── audit-logger.ts                 Opt-in JSON audit trail (stderr)
```

## API Methods (14 total)

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
| `help`                     | Inline type summaries (sync) | Util |

## MCP Resources

5 resources registered in `index.ts`:

| URI                                      | Content                                   | Size                |
| ---------------------------------------- | ----------------------------------------- | ------------------- |
| `constellation://types/api`              | Full API type definitions                 | ~147KB              |
| `constellation://types/api/{methodName}` | Per-method type excerpts                  | ~1-2KB each         |
| `constellation://docs/guide`             | Full Code Mode guide                      | ~3,500 tok          |
| `constellation://docs/guide/{section}`   | Guide sections (methods/recipes/recovery) | ~600-1,200 tok each |
| `constellation://metrics`                | Runtime metrics snapshot (JSON)           | Dynamic             |

**Prefer per-method types** over the full `constellation://types/api` (~147KB) to avoid context bloat.

## Configuration

**Priority**: Env vars → `constellation.json` → Defaults

| Env Variable                      | Purpose                                     |
| --------------------------------- | ------------------------------------------- |
| `CONSTELLATION_ACCESS_KEY`        | API authentication (required)               |
| `CONSTELLATION_API_URL`           | Override API endpoint                       |
| `CONSTELLATION_SANDBOX_ISOLATION` | `convenience` (default) or `hardened`       |
| `CONSTELLATION_AUDIT_LOG`         | `true` to enable JSON audit trail on stderr |
| `DEBUG`                           | Enable verbose logging                      |

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

## Shared Types

All types imported from `@shiftinbits/constellation-types` (centralized in `constellation-types/`).

`src/types/api-types.d.ts` re-exports from the shared package for import convenience.

**Adding types**: Add to `constellation-types/src/`, not locally. See `../CLAUDE.md` Section 3.

## Error Handling

**18 error codes** (from `mcp-errors.ts`):

| Category  | Codes                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Auth      | `AUTH_ERROR`, `AUTHZ_ERROR`, `AUTH_EXPIRED`                                                                                           |
| Config    | `NOT_CONFIGURED`, `API_UNREACHABLE`                                                                                                   |
| Project   | `PROJECT_NOT_INDEXED`, `BRANCH_NOT_FOUND`, `STALE_INDEX`                                                                              |
| Execution | `SYMBOL_NOT_FOUND`, `FILE_NOT_FOUND`, `TOOL_NOT_FOUND`, `VALIDATION_ERROR`, `EXECUTION_TIMEOUT`, `EXECUTION_ERROR`, `MEMORY_EXCEEDED` |
| System    | `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`                                                                               |

**Structured error response** includes: `code`, `type`, `message`, `recoverable`, `guidance[]`, `context`, `docs?`, `suggestedCode?`, `alternativeApproach?`.

**Retry logic** (`constellation-client.ts`): Exponential backoff (1s base, 2^n scaling, 250ms jitter, 30s cap). Retries on 5xx only. Default 3 attempts.

## Sandbox Behavior

**Dual timeout** (`sandbox.ts`): VM timeout catches sync hangs, `Promise.race` catches async hangs.

**Auto-return** (`auto-return.ts`): AST-based implicit `return` prepended to last expression. Handles destructuring, multi-declarator const. Falls back gracefully on parse errors.

**Rate limiting**: Max 50 API calls per execution (configurable via `maxApiCalls`).

**Code validation** (`validators/`): Acorn AST parser walks tree checking for dangerous globals, dangerous properties, computed property chains, dynamic `import()`, and `with` statements. Warnings emitted for dynamic computed property access.

**Limits** (`constants/sandbox-limits.ts` + `result-limits.ts`):

| Limit             | Value                              |
| ----------------- | ---------------------------------- |
| Default timeout   | 30s                                |
| Min/Max timeout   | 1s – 60s                           |
| Max code size     | 100KB                              |
| Max API calls     | 50                                 |
| Memory limit      | 128MB (best-effort, checked @50ms) |
| Result warn       | 100KB                              |
| Result hard limit | 1MB (truncated with preview)       |

## Observability

**Metrics** (`utils/metrics.ts`): In-memory singleton tracking execution counts, errors, API calls, validation failures, and duration histograms (rolling window, max 1000 samples). Exposed via `constellation://metrics` resource.

**Audit logging** (`utils/audit-logger.ts`): Opt-in via `CONSTELLATION_AUDIT_LOG=true`. JSON entries on stderr with events: `execution_start`, `execution_end`, `api_call`, `validation_failure`, `error`. Code truncated to 500 chars for privacy.

## Build

**Build tool**: `tsup` with two entry points:

| Entry                             | Output                   | Purpose                           |
| --------------------------------- | ------------------------ | --------------------------------- |
| `src/index.ts`                    | `dist/index.js`          | Main MCP server                   |
| `src/code-mode/sandbox-worker.ts` | `dist/sandbox-worker.js` | Child process for IsolatedSandbox |

Config: ESM bundle, tree-shake, minify, `keepNames: true` (preserve stack traces).

**Post-build** (`utils/postbuild.js`): Adds shebang to `dist/index.js` + copies `@shiftinbits/constellation-types` definitions to `dist/types/` for MCP resource serving.

## Testing

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # 70%+ required (branches, functions, lines, statements)
npm run test:ci             # CI mode (--maxWorkers=2)
npm run inspector           # Interactive MCP protocol validation
```

**Structure**: `test/unit/{module}/{file}.test.ts` mirrors `src/`. Helpers in `test/helpers/` (mock factories, test utils). Smoke tests in `test/smoke/`.

**Coverage excludes**: `index.ts`, `worker-path.ts`, `sandbox-worker.ts`, type definitions, example tools.

## Gotchas

- **Logging**: Use `console.error` only (MCP uses stdout for protocol)
- **ESM imports**: Must include `.js` extension (`from './config.js'`)
- **Build tool**: `tsup` (ESM bundle, tree-shake, minify, keepNames) — not tsc directly
- **Windows**: `breakOnSigint` disabled on Windows (can cause hangs)
- **Result truncation**: Large results silently truncated at 1MB with preview (still `success: true`)
- **Config fallback**: Server starts even without config — tools return setup instructions
- **Config cache**: LRU by git root, no file watch — restart required after config changes
- **Auto-return**: Sandbox adds implicit `return` to last expression. Explicit `return` is unchanged
- **Prototype freeze**: All built-in prototypes and constructors are frozen in sandbox to prevent pollution
- **Memory check**: Best-effort periodic sampling (50ms); only IsolatedSandbox has hard V8 limits
- **Rate limit scope**: Max 50 API calls is per-execution, not per-session

## Dependencies

| Package                            | Purpose                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| `@modelcontextprotocol/sdk`        | MCP protocol implementation                                     |
| `@shiftinbits/constellation-types` | Shared type definitions (single source of truth)                |
| `acorn`                            | JS AST parser for code validation (fast, no TS compiler needed) |
| `zod`                              | Runtime schema validation                                       |

## Extended Docs

| Path                    | Content                              |
| ----------------------- | ------------------------------------ |
| `../CLAUDE.md`          | Workspace architecture, shared types |
| `../TROUBLESHOOTING.md` | Error codes, debug commands          |
| `../COMMANDS.md`        | Full command reference               |
| `../ADR.md`             | Architecture decisions               |
