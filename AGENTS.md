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
AI Assistant → MCP (stdio) → code_intel → Sandbox → ConstellationClient → Core intel-api (`/intel/v1`; locally via nginx :4080) → ArcadeDB
```

**Transport**: MCP TypeScript SDK v2 (`@modelcontextprotocol/server`). `index.ts` runs startup config, then `serveStdio(() => buildServer(...))`; `server.ts` `buildServer()` registers the tool and resources and sets cache hints. `serveStdio` serves protocol 2026-07-28 (`server/discover`) and legacy 2025-era clients (`initialize`) from the same factory. Unknown resource-template URIs throw `ResourceNotFoundError` (`-32602`).

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

**Shared types**: all wire contracts from `@constellationdev/types`. Add types in `$TYPES`, not locally.

## API Methods (14)

10 API + 4 utils. API: `searchSymbols`, `getSymbolDetails`, `getDependencies`, `getDependents`, `findCircularDependencies`, `traceSymbolUsage`, `getCallGraph`, `impactAnalysis`, `findOrphanedCode`, `getArchitectureOverview`. Utils: `ping`, `getCapabilities`, `listMethods` (sync), `help` (sync). Each API method maps to a Core executor. To add one: expose `api.x()` in `code-mode/sandbox.ts` + update the tool description.

## MCP Resources

5 registered in `server.ts`. **Prefer per-method types** over the full set to avoid context bloat.

| URI                                      | Content                                   |
| ---------------------------------------- | ----------------------------------------- |
| `constellation://types/api`              | All per-method type excerpts, joined      |
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

**Testing against local Core**: the workspace `.mcp.json` registers `local-constellation` — `node constellation-mcp/dist/index.js` (this repo's build, so `npm run build` and restart Claude Code after MCP changes), env from `LOCAL_CONSTELLATION_*`, nginx `:4080` — for validating Core and MCP changes; the plugin `constellation` server stays on the hosted API. Outside Claude Code: `CONSTELLATION_API_URL=$LOCAL_CONSTELLATION_API_URL CONSTELLATION_ACCESS_KEY=$LOCAL_CONSTELLATION_ACCESS_KEY npm run inspector`. Env override only swaps the API URL; `projectId` still comes from each repo's `constellation.json`, and the local graph is indexed for core only.

Legacy `USAGE_TRACKING_ENABLED=false` is honored transitionally as an opt-out (to be removed). **Multi-project**: `ConfigCache` resolves config per git root via the `cwd` parameter, LRU-cached with no file watch — restart after `constellation.json` changes.

## Error Handling

**21 error codes** (`types/mcp-errors.ts`): Auth (`AUTH_ERROR`, `AUTHZ_ERROR`, `AUTH_EXPIRED`); Config (`NOT_CONFIGURED`, `CWD_NOT_INDEXED`, `API_UNREACHABLE`); Project (`PROJECT_NOT_INDEXED`, `BRANCH_NOT_FOUND`, `STALE_INDEX`); Execution (`SYMBOL_NOT_FOUND`, `FILE_NOT_FOUND`, `TOOL_NOT_FOUND`, `VALIDATION_ERROR`, `UNSUPPORTED_LANGUAGE`, `EXECUTION_ERROR`, `EXECUTION_TIMEOUT`, `MEMORY_EXCEEDED`, `API_CALL_LIMIT_EXCEEDED`); System (`RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`).

Structured response: `code`, `type`, `message`, `recoverable`, `guidance[]`, `context`, `docs?`, `suggestedCode?`, `alternativeApproach?`.

**Retry** (`constellation-client.ts`): exponential backoff (1s base, 2^n, 250ms jitter, 30s cap), 5xx only, 3 attempts.

## Sandbox Behavior

- **Dual timeout** (`sandbox.ts`): VM timeout catches sync hangs; `Promise.race` catches async hangs. Dynamic, AST-weighted per call (1–60s; parse-failure fallback 30s).
- **Auto-return** (`auto-return.ts`): AST-based implicit `return` on last expression (handles destructuring, multi-declarator const). Explicit `return` unchanged; falls back gracefully on parse errors.
- **Validation** (`validators/`): Acorn AST walker flags dangerous globals/properties, computed property chains, dynamic `import()`, `with`.
- **Limits**: 100KB max code; 50 API calls per-execution; 128MB memory (best-effort @50ms; hard limit only in `hardened`). Results warn at 100KB, truncated with preview at 1MB (still `success: true`).

## Hook Mode

For agent-plugin `mcp_tool` hooks (`code-mode/hook-mode.ts`, wired in `runHookMode`). Opt-in via the optional `hook` input; agents omit it, and without it the output is unchanged.

- **Input**: `hook: { event, input?, sessionId?, settings? }`. `event` is one of `PreToolUse`, `PostToolUse`, `SessionStart`, `SubagentStart`, `UserPromptSubmit`, `Stop`. `input` is the hook payload (JSON, max 256 KB serialized). `sessionId` is a string; one over 256 chars is hashed to a bounded key. `settings` lists env names to expose; only `CONSTELLATION_[A-Z0-9_]+` names are kept and `CONSTELLATION_ACCESS_KEY` is always dropped. Values are resolved by the server process.
- **Validation**: `code`, `cwd`, `timeout` and the `hook` object shape are plugin literals, so schema errors on them surface as normal tool errors. The fields inside `hook` are validated by the server instead: a non-string or unknown `event` is a quiet `{}`, a non-string `sessionId` is ignored, and non-array `settings` or non-string entries are dropped (each logged to stderr).
- **`hook` global**: deep-frozen `{ event, input, sessionId, settings, once(key) }`, built inside the sandbox realm. In normal mode `hook` is undeclared (not `undefined`), so test for it with `typeof hook !== 'undefined'`. Read `hook.settings.NAME` directly; unset names are absent, so do not enumerate. `once(key)` is true the first time a key is seen in a session (always true without `sessionId`); keys are non-empty strings of at most 256 chars.
- **Program result**: return `{ context?, message? }` or `null`. `context` becomes `hookSpecificOutput.additionalContext` (every event except `Stop`, max 8000 chars); the first non-blank line of `message` becomes `systemMessage` (max 300 chars). Nothing else can be emitted: advisory only, never deny, block or rewrite.
- **Output**: `structuredContent` is the HookOutput and the text item is its `JSON.stringify`; the no-op is `{}`. `outputSchema` is the union of the envelope and HookOutput (root `type: "object"`).
- **Quiet failures**: unknown event, oversized input, config errors, missing access key, code size or binary chars, any execution error, an unindexed branch, or an empty result all return `{}` without `isError` and log one `[code_intel] hook: <reason>` line to stderr.
- **No usage telemetry**: hook-mode calls never POST usage events.
- **`once` keys** are committed only when the output is non-empty, so a failed or empty run shows its notice again next time. Two concurrent calls for the same session can both claim a key, so a once-notice can rarely show twice; both outputs are kept.
- **Timeouts**: set the plugin hook `timeout: 3` (seconds); hook mode defaults `code_intel` `timeout` to 2500 ms (not the 30s normal-mode default), and an explicit `timeout` still wins.
- **`code` must be a fixed literal**: never interpolate hook placeholders into it; read event data from `hook.input`.

## Observability

- **Metrics** (`utils/metrics.ts`): in-memory singleton (counts, errors, API calls, validation failures, duration histogram; rolling 1000 samples). Exposed via `constellation://metrics`.
- **Audit** (`utils/audit-logger.ts`): opt-in `CONSTELLATION_AUDIT_LOG=true`. JSON on stderr; code truncated to 500 chars for privacy.

## Build

`tsup` (ESM bundle, tree-shake, minify, `keepNames: true`) with two entry points: `src/index.ts` → `dist/index.js` (server) and `src/code-mode/sandbox-worker.ts` → `dist/sandbox-worker.js` (hardened child). Post-build (`utils/postbuild.js`) adds the shebang.

## Testing

`test/unit/{module}/` mirrors `src/`; helpers and mocks in `test/helpers/` + `test/__mocks__/`; smoke test in `test/smoke/`. `test/unit/server.test.ts` drives `buildServer()` with raw JSON-RPC over `InMemoryTransport`. Coverage excludes `index.ts`, `worker-path.ts`, `sandbox-worker.ts`, and type defs. `npm run inspector` validates the live MCP protocol.

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

## Worktrees

Create git worktrees only under this repo's `.claude/worktrees/<branch-slug>` (already gitignored), e.g. `git worktree add .claude/worktrees/feat-x -b feat/x origin/main`. Never create them outside the repo (e.g. sibling `../constellation-<name>-<branch>` folders) or in a `.worktrees/` directory.
