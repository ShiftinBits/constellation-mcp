# Code Mode Sandbox Security

## Overview

The Code Mode sandbox provides **convenience isolation**, not **security isolation**.
It prevents accidental damage and enforces resource limits, but should NOT be relied
upon to protect against intentionally malicious code.

## Security Layers

### 1. Pattern Validation

Before execution, code is validated against dangerous patterns:

- `require()`, `import` - Module loading blocked
- Dynamic code execution functions - Blocked
- `__proto__`, `.constructor.constructor` - Prototype manipulation blocked
- `process`, `child_process` - System access blocked
- `fs`, `net`, `http` - I/O modules blocked
- `globalThis`, `Reflect`, `Proxy` - Escape vectors blocked
- `while(true)`, `for(;;)` - Infinite loops blocked

### 2. Prototype Freezing (SB-102)

All built-in prototypes are frozen to prevent prototype pollution attacks:

```javascript
// These operations will throw TypeError in the sandbox:
Object.prototype.polluted = true;     // Cannot add property
Array.prototype.malicious = () => {}; // Cannot add property
JSON.hacked = true;                   // Cannot add property
```

**Frozen prototypes:**

- `Object.prototype`, `Array.prototype`, `String.prototype`
- `Number.prototype`, `Boolean.prototype`, `Function.prototype`
- `Date.prototype`, `RegExp.prototype`, `Promise.prototype`
- `Map.prototype`, `Set.prototype`

**Frozen constructors:**

- All of the above, plus `JSON` and `Math`

**Global bindings:**

- Constructor names (`Object`, `Array`, etc.) are non-writable and non-configurable

### 3. Strict Mode Enforcement

All code runs in strict mode (`"use strict"`), which:

- Makes frozen object modifications throw errors (instead of silently failing)
- Prevents accidental global variable creation
- Disables `with` statements

### 4. Resource Limits

| Resource          | Default    | Purpose                    |
| ----------------- | ---------- | -------------------------- |
| Execution timeout | 30 seconds | Prevents infinite loops    |
| Memory limit      | 128 MB     | Prevents memory exhaustion |
| API call limit    | 50 calls   | Prevents API abuse         |

### 5. VM Context Isolation

Each execution creates a fresh VM context with isolated:

- Global object
- Built-in prototypes (separate from host)
- Variable scope

## What the Sandbox Protects Against

| Threat                    | Protection                      |
| ------------------------- | ------------------------------- |
| Accidental infinite loops | Timeout enforcement             |
| Memory exhaustion         | Memory limits                   |
| API abuse                 | Rate limiting                   |
| Common escape patterns    | Regex validation                |
| Prototype pollution       | Frozen prototypes + strict mode |
| Cross-execution leakage   | Fresh context per execution     |

## What the Sandbox Does NOT Protect Against

| Threat                          | Why Not Protected                         |
| ------------------------------- | ----------------------------------------- |
| Determined adversarial code     | Node.js vm is not a security sandbox      |
| Side-channel attacks            | Timing attacks, resource probing possible |
| Sophisticated escape techniques | vm module has known limitations           |
| CPU exhaustion within timeout   | Can still use 100% CPU for 30s            |

## Trust Assumptions

This sandbox assumes:

1. **Code is AI-generated** - From trusted AI systems (Claude, GPT, etc.)
2. **Environment is isolated** - MCP server runs with OS-level isolation
3. **Users are non-malicious** - Not intentionally crafting escape code

## Production Recommendations

For production deployments, add OS-level isolation:

### Container Deployment

```dockerfile
FROM node:20-slim

# Run as non-root user
USER node

# Limit capabilities
# In docker-compose or k8s, add:
# - seccomp profiles
# - read-only filesystem
# - no network (except to Constellation API)
# - memory/CPU limits
```

### Process Isolation

```bash
# Run with restricted permissions
node --experimental-permission --allow-fs-read=/app dist/index.js
```

### Network Isolation

- Only allow outbound connections to the Constellation API
- Block all other network access

## Verification

The sandbox security is verified by 24 tests in `test/unit/code-mode/sandbox.test.ts`:

```bash
npm test -- --testPathPatterns="sandbox"
```

Key test categories:

- Prototype freezing (throws on modification)
- Host environment isolation
- Cross-execution isolation
- Normal operations still work
- Constructor reassignment prevention

## Related Files

| File                                  | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `src/code-mode/sandbox.ts`            | Sandbox implementation        |
| `src/code-mode/runtime.ts`            | Code validation and execution |
| `test/unit/code-mode/sandbox.test.ts` | Security tests                |

## Version History

| Version | Change                                               |
| ------- | ---------------------------------------------------- |
| SB-102  | Added prototype freezing and strict mode enforcement |
| SB-85   | Fixed async timeout bypass                           |
| SB-84   | Added console serialization error handling           |
