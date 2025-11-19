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
# Constellation MCP Server - Code Intelligence Tools

Provides **centralized code intelligence** from a shared graph database built from AST analysis.
Use these tools instead of manual file searching when you need to understand code structure,
dependencies, relationships, or impact of changes.

## Core Principle

**Constellation = Code Metadata & Relationships | Read tool = Source Code**

Constellation tells you ABOUT code (structure, dependencies, usage). Always use \`Read\` to view actual file contents.

## When to Use Constellation (Proactive)

Use these tools **automatically** when the user asks:

**Discovery**: "Where is X?", "Find function Y", "Show me all classes"
→ \`search_symbols\`, \`get_symbol_details\`

**Dependencies**: "What does X import?", "What uses X?", "Show call graph"
→ \`get_dependencies\`, \`get_dependents\`, \`trace_symbol_usage\`, \`get_call_graph\`

**Impact Analysis**: "What breaks if I change X?", "Is it safe to delete?", "Show blast radius"
→ \`impact_analysis\` (START HERE), \`get_dependents\`

**Architecture**: "How is this organized?", "Show me the structure"
→ \`get_architecture_overview\`

**Code Quality**: "Find dead code", "What can I delete?"
→ \`find_orphaned_code\`

## When NOT to Use

- **Reading source code** → Use \`Read\` tool
- **Modifying files** → Use \`Edit\` or \`Write\`
- **Running commands** → Use \`Bash\`
- **Project not indexed** → Ask user to run \`constellation index\`
- **Simple file patterns** → Use \`Glob\`
- **Text search** → Use \`Grep\`

## Tool Categories

**Discovery (2)**: \`search_symbols\`, \`get_symbol_details\`
**Dependency (5)**: \`get_dependencies\`, \`get_dependents\`, \`trace_symbol_usage\`, \`get_call_graph\`, \`find_circular_dependencies\`
**Impact (2)**: \`impact_analysis\`, \`find_orphaned_code\`
**Architecture (1)**: \`get_architecture_overview\`

## Common Tool Chaining Patterns

### Pattern 1: Before Refactoring
\`\`\`
1. impact_analysis (depth=1) → Quick safety check
2. If high impact → trace_symbol_usage → See usage patterns
3. If uncertain → get_dependents → List all consumers
4. Make informed decision
\`\`\`

### Pattern 2: Understanding New Codebase
\`\`\`
1. get_architecture_overview → Bird's eye view
2. search_symbols → Find specific code
3. get_symbol_details → Understand symbols
4. trace_symbol_usage → Follow execution flow
\`\`\`

### Pattern 3: Debugging Dependencies
\`\`\`
1. find_circular_dependencies → Check for cycles
2. get_dependencies (file) → What it imports
3. get_dependents (file) → What imports it
4. get_call_graph → Visualize relationships
\`\`\`

### Pattern 4: Finding Dead Code
\`\`\`
1. find_orphaned_code → Get candidates
2. get_dependents → Verify unused
3. get_symbol_details (includeReferences=true) → Double-check
4. Safe to delete if zero dependents/references
\`\`\`

## Best Practices

### Start Small, Escalate
- Use \`depth=1\` first, increase only if needed
- Depth grows **EXPONENTIALLY**: depth=1=10 files, depth=2=100 files, depth=3=1000+ files
- Check result counts before going deeper

### Use symbolId
- After \`search_symbols\`, use returned \`symbolId\` in follow-up calls
- SymbolIds are precise, fast, and avoid ambiguity

### Chain Tools Effectively
- Don't rely on single tool - chain them: Search → Details → Impact → Usage
- For parallel data needs, make concurrent tool calls

### Leverage Cache
- Results are cached (Redis-backed), repeated queries are <100ms
- Feel free to re-run with different parameters

### Filter Appropriately
- Set \`excludeTests=true\` for production-only impact analysis
- Set \`excludeTests=false\` (default) to see ALL usages including tests
- Use \`includeReferences\` only when needed (can be large for popular symbols)

## Quick Decision Matrix

**Need to...**
- Find where X is defined → \`search_symbols\` + \`get_symbol_details\`
- Understand a file → \`Read\` the file
- See what X depends on → \`get_dependencies\`
- See what depends on X → \`get_dependents\` or \`impact_analysis\`
- Check if safe to change X → \`impact_analysis\` (depth=1-2)
- Plan refactoring → \`impact_analysis\` (depth=2-3) + \`trace_symbol_usage\`
- Understand architecture → \`get_architecture_overview\`
- Find dead code → \`find_orphaned_code\`
- Debug circular imports → \`find_circular_dependencies\`

## Tool-Specific Guidance

Each tool has detailed metadata including:
- **whenToUse**: Specific scenarios for this tool
- **examples**: Concrete parameter examples
- **commonMistakes**: What NOT to do with this tool
- **relatedTools**: What to use before/after

This metadata is available in tool definitions and surfaces contextually during tool usage.

**Start Here for New Users:**
1. \`get_architecture_overview\` - Understand the codebase
2. \`search_symbols\` - Find specific code
3. \`impact_analysis\` - Before any changes
`.trim();
}
