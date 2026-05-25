# constellation-mcp

MCP server bridging AI assistants to constellation-core for code intelligence. Single `code_intel` tool that executes JavaScript against an `api` object (14 methods) inside a sandbox.

**See** `../AGENTS.md` for workspace architecture, shared-types workflow, and the "Add an MCP API Method" recipe. **Engines**: Node 20+, npm 10+.

## Quick Reference

| Task          | Command                              |
| ------------- | ------------------------------------ |
| Build + start | `npm start`                          |
| Dev watch     | `npm run watch`                      |
| Test          | `npm test` / `test:coverage` (70%+)  |
| Lint          | `npm run lint:fix` / `lint:errors`   |
| Type check    | `npm run type-check`                 |
| MCP Inspector | `npm run inspector` (protocol check) |
| Benchmark     | `npm run benchmark`                  |

## Architecture

```
AI Assistant → MCP (stdio) → code_intel → Sandbox → ConstellationClient → Core:3000 → Neo4j
```

**Layer stack** (file = primary owner of that concern):

| Layer   | File                             | Responsibility                                        |
| ------- | -------------------------------- | ----------------------------------------------------- |
| Tool    | `tools/query-code-graph-tool.ts` | Input validation, config resolution, error transform  |
| Runtime | `code-mode/runtime.ts`           | Orchestration, isolation selection, result formatting |
| Sandbox | `code-mode/sandbox.ts`           | VM isolation, dual timeout, AST validation, API proxy |
| Client  | `client/constellation-client.ts` | HTTP with retry/backoff, auth headers                 |
| Config  | `config/config-cache.ts`         | Multi-project resolution, LRU cache by git root       |

**Sandbox isolation** (`CONSTELLATION_SANDBOX_ISOLATION`):

| Aspect          | `convenience` (default)      | `hardened`                            |
| --------------- | ---------------------------- | ------------------------------------- |
| Execution       | VM, same process             | Child process fork (`sandbox-worker`) |
| Memory limit    | Periodic check (best-effort) | Hard `--max-old-space-size`           |
| Timeout         | VM timeout + `Promise.race`  | SIGKILL (no escape)                   |
| Crash isolation | None (crashes MCP server)    | Child crash contained                 |

**Shared types**: all wire contracts from `@constellationdev/types`; `src/types/api-types.d.ts` re-exports. Add types in `$TYPES`, not locally.

## API Methods (14)

10 API + 4 utils. API: `searchSymbols`, `getSymbolDetails`, `getDependencies`, `getDependents`, `findCircularDependencies`, `traceSymbolUsage`, `getCallGraph`, `impactAnalysis`, `findOrphanedCode`, `getArchitectureOverview`. Utils: `ping`, `getCapabilities`, `listMethods` (sync), `help` (sync). Each API method maps to a Core executor. To add one: expose `api.x()` in `code-mode/sandbox.ts` + update the tool description.

## MCP Resources

5 registered in `index.ts`. **Prefer per-method types** over the ~147KB full set to avoid context bloat.

| URI                                      | Content                                   |
| ---------------------------------------- | ----------------------------------------- |
| `constellation://types/api`              | Full API type definitions (~147KB)        |
| `constellation://types/api/{methodName}` | Per-method type excerpts (~1-2KB)         |
| `constellation://docs/guide`             | Full Code Mode guide                      |
| `constellation://docs/guide/{section}`   | Guide sections (methods/recipes/recovery) |
| `constellation://metrics`                | Runtime metrics snapshot (JSON, dynamic)  |

## Configuration

**Priority**: env vars → `constellation.json` (at git root) → defaults. `CONSTELLATION_ACCESS_KEY` is required. Server starts without config — tools return setup instructions.

| Env Variable                      | Purpose                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `CONSTELLATION_API_URL`           | Override API endpoint                                                                          |
| `CONSTELLATION_SANDBOX_ISOLATION` | `convenience` (default) or `hardened`                                                          |
| `CONSTELLATION_AUDIT_LOG`         | `true` enables JSON audit trail on stderr                                                      |
| `CONSTELLATION_USAGE_METRICS`     | `false`/`0` disables per-call telemetry POST (narrow contract — `no`/`off` do **not** disable) |
| `USAGE_ENDPOINT_URL`              | Override usage receiver (default `${CONSTELLATION_API_URL}/intel/v1/usage`)                    |
| `DEBUG`                           | Verbose logging                                                                                |

Legacy `USAGE_TRACKING_ENABLED=false` is honored transitionally as an opt-out (to be removed). **Multi-project**: `ConfigCache` resolves config per git root via the `cwd` parameter, LRU-cached with no file watch — restart after `constellation.json` changes.

## Error Handling

**20 error codes** (`types/mcp-errors.ts`): Auth (`AUTH_ERROR`, `AUTHZ_ERROR`, `AUTH_EXPIRED`); Config (`NOT_CONFIGURED`, `CWD_NOT_INDEXED`, `API_UNREACHABLE`); Project (`PROJECT_NOT_INDEXED`, `BRANCH_NOT_FOUND`, `STALE_INDEX`); Execution (`SYMBOL_NOT_FOUND`, `FILE_NOT_FOUND`, `TOOL_NOT_FOUND`, `VALIDATION_ERROR`, `UNSUPPORTED_LANGUAGE`, `EXECUTION_ERROR`, `EXECUTION_TIMEOUT`, `MEMORY_EXCEEDED`); System (`RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`).

Structured response: `code`, `type`, `message`, `recoverable`, `guidance[]`, `context`, `docs?`, `suggestedCode?`, `alternativeApproach?`.

**Retry** (`constellation-client.ts`): exponential backoff (1s base, 2^n, 250ms jitter, 30s cap), 5xx only, 3 attempts.

## Sandbox Behavior

- **Dual timeout** (`sandbox.ts`): VM timeout catches sync hangs; `Promise.race` catches async hangs. Dynamic, AST-weighted per call (1–60s; parse-failure fallback 30s).
- **Auto-return** (`auto-return.ts`): AST-based implicit `return` on last expression (handles destructuring, multi-declarator const). Explicit `return` unchanged; falls back gracefully on parse errors.
- **Validation** (`validators/`): Acorn AST walker flags dangerous globals/properties, computed property chains, dynamic `import()`, `with`.
- **Limits**: 100KB max code; 50 API calls per-execution; 128MB memory (best-effort @50ms; hard limit only in `hardened`). Results warn at 100KB, truncated with preview at 1MB (still `success: true`).

## Observability

- **Metrics** (`utils/metrics.ts`): in-memory singleton (counts, errors, API calls, validation failures, duration histogram; rolling 1000 samples). Exposed via `constellation://metrics`.
- **Audit** (`utils/audit-logger.ts`): opt-in `CONSTELLATION_AUDIT_LOG=true`. JSON on stderr; code truncated to 500 chars for privacy.

## Build

`tsup` (ESM bundle, tree-shake, minify, `keepNames: true`) with two entry points: `src/index.ts` → `dist/index.js` (server) and `src/code-mode/sandbox-worker.ts` → `dist/sandbox-worker.js` (hardened child). Post-build (`utils/postbuild.js`) adds the shebang and copies `@constellationdev/types` defs to `dist/types/` for resource serving.

## Testing

`test/unit/{module}/` mirrors `src/`; helpers and mocks in `test/helpers/` + `test/__mocks__/`; smoke test in `test/smoke/`. Coverage excludes `index.ts`, `worker-path.ts`, `sandbox-worker.ts`, and type defs. `npm run inspector` validates the live MCP protocol.

## Gotchas

- **Logging**: `console.error` only — stdout is the MCP protocol channel.
- **ESM imports**: must include `.js` extension (`from './config.js'`).
- **Pre-commit**: husky + lint-staged run eslint/prettier on staged files.
- **Config cache**: LRU by git root, no file watch — restart after `constellation.json` changes.
- **Result truncation**: large results silently truncated at 1MB with preview (still `success: true`).
- **Prototype freeze**: built-in prototypes/constructors frozen in the sandbox to prevent pollution.
- **Windows**: `breakOnSigint` disabled (can cause hangs).

## Extended Docs

`../AGENTS.md` (workspace, shared types) · `../TROUBLESHOOTING.md` (error codes, debug) · `../COMMANDS.md` (commands) · `../ADR.md` (decisions).
