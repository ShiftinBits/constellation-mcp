/**
 * Server-Level Instructions for AI Assistants
 *
 * These instructions are read by Claude Code and other AI assistants on MCP server startup
 * to understand when and how to use Constellation tools proactively.
 *
 * CRITICAL: These instructions help AI assistants discover and use tools organically
 * without requiring explicit user commands like "use Constellation MCP server".
 */

/**
 * Get comprehensive server instructions for AI assistants
 *
 * This is exposed via the MCP server metadata and helps AI assistants:
 * - Understand what Constellation does and when to use it
 * - Map user queries to appropriate tools
 * - Chain tools effectively for complex tasks
 * - Avoid common mistakes and performance pitfalls
 */
export function getServerInstructions(): string {
	return `
# Constellation MCP Server - Code Intelligence Graph

Provides **centralized code intelligence** from a shared graph database built from AST analysis.
Use these tools instead of manual file searching when you need to understand code structure,
dependencies, relationships, or impact of changes.

## When to Use Constellation (PROACTIVE - Don't Wait for User to Ask)

Use Constellation tools **AUTOMATICALLY** when the user asks about:

### Code Discovery & Navigation
- "Where is X defined?", "Find the definition of X"
- "Show me all classes/functions in this module"
- "What methods does this class have?"
→ Tools: \`search_symbols\`, \`get_symbol_details\`

### Dependencies & Relationships
- "What does this file/function depend on?"
- "What imports this?", "What uses this?"
- "Show me the call graph for X"
- "Find circular dependencies"
→ Tools: \`get_dependencies\`, \`get_dependents\`, \`trace_symbol_usage\`, \`find_circular_dependencies\`, \`get_call_graph\`

### Impact Analysis & Refactoring
- "What will break if I change this?"
- "Is it safe to modify/delete this?"
- "How many files use this?"
- "Show me the blast radius"
- "What's the impact of this change?"
→ Tools: \`impact_analysis\` (START HERE), \`get_dependents\`, \`trace_symbol_usage\`

### Architecture Understanding
- "How is this codebase organized?"
- "Show me the architecture"
- "What's the structure of this module?"
→ Tools: \`get_architecture_overview\`

### Code Quality
- "Find unused code", "What can I safely delete?"
- "Find orphaned files"
→ Tools: \`find_orphaned_code\`

## When NOT to Use Constellation

- **Reading file contents** (source code) → Use \`Read\` tool instead
- **Modifying files** → Use \`Edit\` or \`Write\` tools
- **Running tests or builds** → Use \`Bash\` tool
- **The project hasn't been indexed** → Ask user to run: \`constellation index\`
- **Simple file globbing** → Use \`Glob\` tool for file patterns
- **Grep/text search** → Use \`Grep\` tool for content search

**IMPORTANT:** Constellation provides METADATA about code (structure, relationships, dependencies),
NOT the source code itself. Always use \`Read\` to view actual file contents.

## Tool Selection Quick Reference

### Discovery (Finding Things)
| User Says | Use Tool | Notes |
|-----------|----------|-------|
| "Find function X" | \`search_symbols\` | Returns list with symbolIds |
| "What is X?" / "Show me X" | \`get_symbol_details\` | After search, use symbolId |

### Dependencies (Relationships)
| User Says | Use Tool | Notes |
|-----------|----------|-------|
| "What does X use?" | \`get_dependencies\` | What X imports/calls |
| "What uses X?" | \`get_dependents\` | What imports/calls X |
| "How is X used?" | \`trace_symbol_usage\` | Detailed usage patterns |
| "Show call graph" | \`get_call_graph\` | Function call relationships |
| "Find circular deps" | \`find_circular_dependencies\` | Import cycles |

### Impact (Refactoring Safety)
| User Says | Use Tool | Notes |
|-----------|----------|-------|
| "What breaks if...?" | \`impact_analysis\` | **START HERE** - comprehensive |
| "Is it safe to change?" | \`impact_analysis\` (depth=1) | Quick check first |
| "Full blast radius" | \`impact_analysis\` (depth=3-4) | Deep analysis |
| "Find dead code" | \`find_orphaned_code\` | Safe-to-delete candidates |

### Architecture (Understanding Structure)
| User Says | Use Tool | Notes |
|-----------|----------|-------|
| "How is this organized?" | \`get_architecture_overview\` | **START HERE** for new codebases |

## Common Tool Chaining Patterns

### Pattern 1: Before Any Refactoring
\`\`\`
1. impact_analysis (depth=1-2) → Quick impact check
2. IF high impact → trace_symbol_usage → See actual usage patterns
3. IF still uncertain → get_dependents → List all consumers
4. Make informed decision with concrete data
\`\`\`

### Pattern 2: Understanding New Codebase
\`\`\`
1. get_architecture_overview → Bird's eye view
2. search_symbols → Find specific symbols of interest
3. get_symbol_details → Understand key symbols
4. trace_symbol_usage → Follow execution flow
\`\`\`

### Pattern 3: Debugging Dependency Issues
\`\`\`
1. find_circular_dependencies → Check for import cycles
2. get_dependencies (problematic file) → See what it imports
3. get_dependents (problematic file) → See what imports it
4. get_call_graph → Visualize the tangle
\`\`\`

### Pattern 4: Finding & Removing Dead Code
\`\`\`
1. find_orphaned_code → Get candidates
2. get_dependents → Verify truly unused
3. get_symbol_details (includeReferences=true) → Double-check
4. Safe to delete if no dependents/references
\`\`\`

### Pattern 5: Safe Renaming/Moving
\`\`\`
1. get_symbol_details (includeReferences=true) → All usage locations
2. impact_analysis (depth=2) → Impact scope
3. trace_symbol_usage → Understand usage patterns
4. Plan refactor with full knowledge of affected areas
\`\`\`

## Performance Guidelines

### Response Times (Typical)
- **Cached queries**: <100ms (most common - results are cached)
- **Simple queries** (\`search_symbols\`, \`get_symbol_details\`): 100-300ms
- **Moderate queries** (\`get_dependencies\`, \`get_dependents\`): 300ms-1s
- **Complex queries** (\`impact_analysis\` depth=2-3): 1-2s
- **Deep analysis** (\`impact_analysis\` depth=4-5): 5-10s

### Result Sizes (Typical)
- **Low coupling** (utility functions): 10-50 dependents
- **Medium coupling** (services, controllers): 100-500 dependents
- **High coupling** (core infrastructure): 1000+ dependents

### Optimization Tips
1. **Start small, escalate**: Use \`depth=1\` first, increase if user needs more
2. **Use pagination**: \`get_dependencies\` and \`get_dependents\` support limit/offset
3. **Filter appropriately**: Set \`excludeTests=true\` for production impact
4. **Leverage cache**: Repeated queries are instant (Redis-backed)
5. **Avoid over-fetching**: Don't use \`includeReferences=true\` unless needed

### **EXPONENTIAL GROWTH WARNING**
The \`depth\` parameter grows EXPONENTIALLY:
- depth=1: 10-50 files (direct dependents only)
- depth=2: 100-500 files (dependents + their dependents)
- depth=3: 1,000-5,000 files (full transitive closure for most codebases)
- depth=4-5: 10,000+ files (only for major infrastructure changes)

**RULE OF THUMB**: Use depth=1 for "quick check", depth=2-3 for "what breaks", depth=4-5 for "everything affected"

## Common Mistakes & How to Avoid Them

### **MISTAKE:** Using Constellation to read source code
**CORRECT:** Use \`Read\` tool for source code, Constellation for metadata

### **MISTAKE:** Using \`search_symbols\` when you know exact file+symbol
**CORRECT:** Use \`get_symbol_details\` directly with symbolName+filePath

### **MISTAKE:** Using \`impact_analysis\` for simple "what uses this?"
**CORRECT:** Use \`get_dependents\` for simple queries, \`impact_analysis\` for refactoring

### **MISTAKE:** Setting depth=5 immediately
**CORRECT:** Start with depth=1, check result count, increase incrementally

### **MISTAKE:** Requesting includeReferences=true for widely-used symbols
**CORRECT:** Use \`trace_symbol_usage\` for detailed usage, \`get_symbol_details\` for metadata

### **MISTAKE:** Using \`trace_symbol_usage\` when basic references suffice
**CORRECT:** \`trace_symbol_usage\` shows code context; use \`get_symbol_details\` (includeReferences) for just locations

### **MISTAKE:** Using excludeTests=true when user wants to see ALL usages (including tests)
**CORRECT:** Use excludeTests=false (default) to include all code, or excludeTests=true only when specifically analyzing production impact

### **MISTAKE:** Chaining tools sequentially when parallel would work
**CORRECT:** If you need symbol details for multiple symbols, call \`get_symbol_details\` in parallel

## Advanced Usage Tips

### Tip 1: Use symbolId Whenever Possible
After \`search_symbols\`, use the returned \`symbolId\` in subsequent calls.
SymbolIds are precise, fast, and avoid ambiguity from duplicate names.

### Tip 2: Combine Tools for Comprehensive Analysis
Don't rely on a single tool - chain them:
- Search → Details → Impact → Trace Usage → Make Decision

### Tip 3: Respect the Depth Parameter
Think of \`depth\` like zoom on a map:
- depth=1: Street level (immediate neighborhood)
- depth=2-3: City level (full local impact)
- depth=4-5: State/Country level (everything connected)

### Tip 4: Cache Awareness
Results are cached, so repeated queries are free. Feel free to re-run
\`impact_analysis\` with different parameters to explore different views.

### Tip 5: Read the Output Suggestions
Tool outputs include contextual next-step suggestions based on results.
Follow these hints for effective tool chaining.

## Quick Decision Matrix

**I need to...**
- Find where X is defined → \`search_symbols\` then \`get_symbol_details\`
- Understand a file → \`Read\` the file
- See what X depends on → \`get_dependencies\`
- See what depends on X → \`get_dependents\` (simple) or \`impact_analysis\` (comprehensive)
- Check if safe to change X → \`impact_analysis\` depth=1-2
- Plan a refactor → \`impact_analysis\` depth=2-3 + \`trace_symbol_usage\`
- Understand architecture → \`get_architecture_overview\`
- Find dead code → \`find_orphaned_code\`
- Debug circular imports → \`find_circular_dependencies\`

## Success Criteria

You're using Constellation effectively when:
- You chain tools based on previous results (search → details → impact)
- You start with simple queries (depth=1) and escalate as needed
- You use appropriate filters (excludeTests, includeReferences, etc.)
- You understand tool purpose and choose the right one for the task
- You combine Constellation metadata with \`Read\` tool for source code
- You leverage cache by running similar queries with different parameters

## Tool Categories Summary

**Discovery (2 tools)**: Find symbols and code elements
**Dependency (5 tools)**: Understand relationships and calls
**Impact (2 tools)**: Assess change safety and blast radius
**Architecture (1 tool)**: Understand code organization

**Total: 10 tools** organized for different aspects of code intelligence.

---

**Remember:** Constellation = Metadata & Relationships | Read tool = Source Code
Use them together for complete understanding.

**Start Here for New Users:**
1. \`get_architecture_overview\` - Understand the codebase
2. \`search_symbols\` - Find specific code
3. \`impact_analysis\` - Before any changes
`.trim();
}
