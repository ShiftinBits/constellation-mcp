/**
 * Constellation Guide Prompt Registration
 *
 * Provides comprehensive guidance for AI coding assistants on how to effectively
 * use the Constellation MCP tools for code intelligence and analysis.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Get the comprehensive guide content for AI assistants
 */
function getGuideContent(): string {
	return `# Constellation MCP - AI Assistant Guide

## Overview

Constellation provides code intelligence through a shared graph database. Use these tools to understand code structure, dependencies, impact, and relationships without analyzing source code directly.

## Core Principles

1. **Server-Side Intelligence**: All analysis is pre-computed. Tools return instant results from a graph database.
2. **No Source Code**: You receive metadata, relationships, and intelligence - never raw source code.
3. **Pagination Aware**: Most tools support limit/offset for large result sets. Start with defaults, increase as needed.
4. **Semantic Markers**: Tool outputs include markers like [EXPORTED], [TEST], [HIGH_IMPACT] to highlight important characteristics.

## Tool Selection Guide

### Discovery & Search
**search_symbols** - First stop for finding code elements
- TRIGGERS: "find X", "where is X", "show me all Y", "locate class X", "search for function", "find symbol"
- Use when: Looking for functions, classes, variables by name
- Best for: "Find all functions named 'handleAuth'", "Where is UserService defined?"
- Tip: Supports fuzzy matching, returns qualified names and locations
- Default limit: 50, increase to 100 for broad searches

### Deep Dive
**get_symbol_details** - Complete information about a specific symbol
- TRIGGERS: "what is X", "show me X", "what does X do", "tell me about X", "explain X", "details about X"
- Use when: Need full picture of a symbol (signature, docs, relationships)
- Best for: "What does calculateTotal do?", "What are the parameters?"
- Requires: symbolId OR (symbolName + filePath)
- Tip: Enable includeReferences to see all usage locations
- Tip: Enable includeRelationships to see what it calls/is called by

**trace_symbol_usage** - Find everywhere a symbol is used
- TRIGGERS: "how is X used", "show all callers", "where is this referenced", "who calls X", "usage of X", "find all uses"
- Use when: Need to understand usage patterns across codebase
- Best for: "Where is UserService imported?", "How is this function called?"
- Supports: Filtering by usage type (import, call, reference)
- Default limit: 50, max: 500 for heavily-used symbols
- Tip: Group results by file for better understanding

### Dependency Analysis
**get_dependencies** - What does this file depend on?
- TRIGGERS: "what does X import", "show dependencies", "what does X depend on", "show imports", "what does X require"
- Use when: Understanding file imports and dependencies
- Best for: "What does Button.tsx import?", "Find dependency chains"
- Supports: Transitive analysis (depth parameter)
- Default limit: 20, increase to 50+ for heavily-coupled files

**get_dependents** - What depends on this file? (inverse)
- TRIGGERS: "what uses X", "who imports this", "can I delete this", "is this used", "what depends on X", "who needs this"
- Use when: Assessing change impact
- Best for: "What will break if I change this?", "Is this file used?"
- **Critical for refactoring** - shows blast radius
- Default limit: 20, increase to 100 for critical shared modules
- Tip: Check "Suggested Next Steps" for risk-appropriate actions

### Call Graph Analysis
**get_call_graph** - Function invocation relationships
- TRIGGERS: "show call graph", "what calls this function", "execution flow", "what does X call", "call hierarchy", "trace call chain"
- Use when: Understanding execution flow
- Best for: "What calls this function?", "What does this function call?"
- Supports: Bidirectional (callers, callees, both)
- Depth control: 1-10 levels deep (default: 3)
- Default limit: 25 per direction, increase to 100 for orchestrator functions

### Impact & Risk Assessment
**impact_analysis** - Comprehensive change impact analysis
- TRIGGERS: "what will break", "is it safe to change", "show blast radius", "impact of changing", "breaking change risk", "can I modify this safely"
- Use when: Planning significant changes
- Best for: "What's affected if I modify this?", "Breaking change risk?"
- Returns: Direct dependents, transitive impact, risk score, recommendations
- **Use before refactoring** - provides action plan based on risk level
- Tip: Shows test vs production file breakdown

**find_circular_dependencies** - Detect circular dependency cycles
- TRIGGERS: "find circular dependencies", "are there import cycles", "circular refs", "module loading failing", "dependency loop", "find cycles"
- Use when: Debugging module loading issues or planning refactors
- Best for: "Why does this fail to import?", "Find circular deps"
- Supports: Filtering by minimum cycle length
- Default limit: 50, increase to 100 for comprehensive cycle detection
- Tip: Fix shortest cycles first (min cycle length = 2)

**find_orphaned_code** - Find unused/dead code
- TRIGGERS: "find dead code", "what can I delete", "show unused exports", "clean up unused code", "find unused", "orphaned code"
- Use when: Cleaning up codebase
- Best for: "What can we delete?", "Find unused exports"
- Filters: By file pattern, symbol kind
- Default limit: 50, increase to 100 for major cleanup initiatives
- Tip: Verify before deletion (check dynamic imports, config references)

### Architecture Overview
**get_architecture_overview** - High-level codebase structure
- TRIGGERS: "how is this organized", "show architecture", "overview of codebase", "project structure", "codebase structure", "show me the architecture"
- Use when: Getting oriented in a new codebase
- Best for: "What's the project structure?", "How big is this codebase?"
- Returns: Module counts, dependencies, optional metrics/graphs
- Tip: Start here for new projects

## Semantic Markers

Tool outputs include markers to highlight important characteristics:

- **[EXPORTED]** - Publicly exported symbol (breaking changes affect consumers)
- **[INTERNAL]** - Not exported (safe to change within module)
- **[DEPRECATED]** - Marked for removal (plan migration)
- **[ABSTRACT]** - Abstract class/method (has implementations to update)
- **[TEST]** - Test file (changes have lower production risk)
- **[CONFIG]** - Configuration file (changes affect runtime behavior)
- **[GENERATED]** - Auto-generated (don't edit manually)
- **[EXTERNAL]** - From node_modules/vendor (not project code)
- **[UNUSED]** - Never used/imported (candidate for deletion)
- **[HEAVILY_USED]** - 20+ usages (high-impact changes)
- **[HIGH_IMPACT]** - Critical to many dependents (extreme caution)
- **[BREAKING]** - Breaking change risk (critical risk level)
- **[SAFE]** - Safe to modify/delete (low/no risk)
- **[RISKY]** - Moderate to high change risk

## Pagination Best Practices

### Start with Defaults
Most tools have sensible defaults. Only increase when:
- Results truncated and you need complete picture
- "... and X more" appears in output
- Working with known high-traffic symbols/files

### Progressive Refinement
1. **First query**: Use default limit
2. **Assess**: Check returned count vs total
3. **Refine**: Increase limit or add filters
4. **Iterate**: Use offset for pagination if needed

### Tool-Specific Limits

| Tool | Default | Max | When to Increase |
|------|---------|-----|------------------|
| search_symbols | 50 | 100 | Broad searches, pattern matching |
| get_dependencies | 20 | 100 | Heavily-coupled files |
| get_dependents | 20 | 100 | Popular shared utilities |
| get_call_graph | 25 | 100 | Central orchestrator functions |
| trace_symbol_usage | 50 | 500 | Widely-used symbols (500 max!) |
| find_circular_dependencies | 50 | 100 | Comprehensive cycle detection |
| find_orphaned_code | 50 | 100 | Major cleanup initiatives |

## Common Workflows

### 1. Understanding a New Function
\`\`\`
search_symbols (query="functionName")
  → get_symbol_details (symbolId from search)
    → get_call_graph (symbolId, direction="both")
\`\`\`

### 2. Assessing Refactoring Impact
\`\`\`
get_dependents (filePath="src/utils/helpers.ts")
  → Check dependent count and risk level
  → impact_analysis (filePath) for comprehensive view
    → Review breaking change risk and recommendations
\`\`\`

### 3. Tracing a Bug
\`\`\`
search_symbols (query="buggyFunction")
  → trace_symbol_usage (symbolId)
    → Group by usage type (call, import, reference)
    → get_call_graph for execution flow context
\`\`\`

### 4. Cleaning Up Code
\`\`\`
find_orphaned_code (filePattern="src/legacy/**")
  → Review confidence scores
  → get_dependents for each candidate (verify truly unused)
  → Delete with confidence
\`\`\`

### 5. Resolving Circular Dependencies
\`\`\`
find_circular_dependencies (minCycleLength=2)
  → get_dependencies for files in cycle
  → Plan extraction/refactoring
  → Verify with impact_analysis
\`\`\`

### 6. Planning Breaking Changes
\`\`\`
impact_analysis (symbolName="MyClass", filePath="src/models/MyClass.ts")
  → Review risk level (low/medium/high/critical)
  → Check direct vs transitive dependents
  → Follow recommended action plan
  → trace_symbol_usage to understand usage patterns
\`\`\`

## Performance Tips

1. **Cache Awareness**: Results are cached. Repeated queries are instant.
2. **Filter Early**: Use filePattern, filterByKind to narrow results
3. **Depth Control**: Start with depth=1, increase only if needed
4. **Exclude Options**: Use excludeTests, excludeGenerated to focus on production code
5. **Limit Appropriately**: Don't request limit=100 when 20 would suffice

## Error Handling

If a tool returns an error:
1. **Check configuration**: Is CONSTELLATION_ACCESS_KEY set?
2. **Verify parameters**: Required params provided? (filePath, symbolId, etc.)
3. **Check project state**: Is the project indexed in Constellation?
4. **Read error message**: May contain setup instructions if misconfigured

## Suggested Next Steps

Many tools include a "Suggested Next Steps" section based on results:
- **Low impact**: Basic verification steps
- **Moderate impact**: Comprehensive testing recommendations
- **High impact**: Multi-step action plan with tool suggestions

Always review these suggestions - they're contextual to the specific query results.

## When NOT to Use These Tools

- **Reading source code**: Use your standard file reading tools
- **Editing code**: These are read-only analysis tools
- **Real-time parsing**: Results reflect last index time, not live edits
- **Language-specific analysis**: Generic symbol/relationship analysis only

## Best Practices

1. **Start broad, then narrow**: search → details → trace
2. **Assess before changing**: Use get_dependents/impact_analysis before refactoring
3. **Trust the markers**: [HIGH_IMPACT] and [BREAKING] are serious warnings
4. **Follow suggestions**: "Suggested Next Steps" are contextual and helpful
5. **Paginate thoughtfully**: Only increase limits when you need comprehensive results
6. **Combine tools**: Multi-tool workflows provide richer context

---

This MCP server provides **code intelligence**, not code content. Use it to understand **structure, relationships, and impact** - then use standard tools to read/modify the actual code.`;
}

/**
 * Register the constellation-guide prompt with the MCP server
 *
 * @param server - The McpServer instance to register the prompt with
 */
export function registerConstellationGuidePrompt(server: McpServer): void {
	server.registerPrompt(
		'constellation-guide',
		{
			title: 'Constellation AI Assistant Guide',
			description: 'Comprehensive guide for AI assistants on using Constellation MCP tools effectively',
			argsSchema: {}, // No arguments needed
		},
		async () => ({
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: getGuideContent(),
					},
				},
			],
		})
	);

	console.error('[constellation-guide] Prompt registered successfully');
}
