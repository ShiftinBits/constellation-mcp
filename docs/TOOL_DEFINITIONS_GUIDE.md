# Tool Definitions Guide

This guide explains the enhanced tool definition system in Constellation MCP and how to create rich, AI-friendly tool definitions.

## Overview

The Constellation MCP server uses an enhanced tool definition system that provides rich metadata to help AI agents (like Claude Code) understand when and how to use each tool effectively. Each tool has:

- **Rich descriptions** (2-3 sentences) explaining what, when, and why
- **Concrete examples** showing actual parameter combinations
- **Use case scenarios** mapping user intent to tool selection
- **Common mistakes** to help avoid errors
- **Related tools** for effective tool chaining
- **Performance notes** for optimization guidance

## Architecture

```
src/registry/
├── McpToolDefinition.interface.ts   # Enhanced definition interface
├── ToolRegistry.ts                   # Central registry with validation
├── tool-selector.ts                  # Intent-based discovery utilities
└── tool-definitions/                 # Individual tool definitions
    ├── index.ts                      # Export point for all definitions
    ├── search-symbols.definition.ts
    ├── get-symbol-details.definition.ts
    └── ... (10 total tools)
```

## Creating a Tool Definition

### Step 1: Import the Interface

```typescript
import { McpToolDefinition } from '../McpToolDefinition.interface.js';
```

### Step 2: Create the Definition

```typescript
export const myToolDefinition: McpToolDefinition = {
	name: 'my_tool',              // Must match actual tool name (snake_case)
	category: 'Discovery',         // One of: Discovery, Dependency, Impact, Architecture, Refactoring

	// Rich description (2-3 sentences)
	description:
		'First sentence: what does this tool do? ' +
		'Second sentence: when should you use it? ' +
		'Third sentence: how does it differ from similar tools?',

	// Optional short summary for lists
	shortDescription: 'One-line summary for tool lists',

	// 3-7 use case scenarios
	whenToUse: [
		'Use case 1: specific scenario',
		'Use case 2: another scenario',
		'Use case 3: yet another scenario',
	],

	// Related tools (commonly used before/after)
	relatedTools: ['other_tool_1', 'other_tool_2'],

	// JSON Schema with enhanced descriptions
	inputSchema: {
		type: 'object',
		properties: {
			param1: {
				type: 'string',
				description:
					'What this parameter does. ' +
					'Format examples: "example1", "example2". ' +
					'Valid values: value1, value2.',
			},
			param2: {
				type: 'number',
				minimum: 1,
				maximum: 10,
				default: 5,
				description: 'Numeric parameter with clear bounds and defaults',
			},
		},
		required: ['param1'],
	},

	// 2-5 concrete examples
	examples: [
		{
			title: 'Basic usage',
			description: 'What this example demonstrates',
			parameters: {
				param1: 'value1',
				param2: 5,
			},
			expectedOutcome: 'What the AI should expect to see',
		},
		{
			title: 'Advanced usage',
			description: 'More complex scenario',
			parameters: {
				param1: 'complex_value',
				param2: 10,
			},
		},
	],

	// Optional: common mistakes
	commonMistakes: [
		'Mistake 1: doing X instead of Y',
		'Mistake 2: not considering Z',
	],

	// Optional: performance notes
	performanceNotes: [
		'Operation X takes 2-3 seconds',
		'Results cached for 5 minutes',
	],

	// Optional: version info
	sinceVersion: '0.0.1',
};
```

### Step 3: Register the Definition

Add to `src/registry/tool-definitions/index.ts`:

```typescript
// Import
export { myToolDefinition } from './my-tool.definition.js';
import { myToolDefinition } from './my-tool.definition.js';

// Add to allToolDefinitions array
export const allToolDefinitions: McpToolDefinition[] = [
	// ... existing tools
	myToolDefinition,
];

// Add to category object
export const toolDefinitionsByCategory = {
	// ... existing categories
	Discovery: [
		// ... existing tools
		myToolDefinition,
	],
};
```

## Definition Quality Standards

### Descriptions

✅ **Good**: "Search for symbols (functions, classes, variables) across your codebase by name or pattern. Use this when you need to find where a symbol is defined or explore available APIs. For detailed information about a specific symbol, use get_symbol_details instead."

❌ **Bad**: "Search symbols in code"

### Use Cases

✅ **Good**:
- "Finding where a function is called across the codebase"
- "Understanding all dependencies of a module before refactoring"

❌ **Bad**:
- "Finding stuff"
- "Code analysis"

### Parameter Descriptions

✅ **Good**: `depth: "How many levels deep to traverse dependencies (1=direct, 2-3=typical, 4+=comprehensive). Start with 1 for initial exploration. Maximum: 10."`

❌ **Bad**: `depth: "Depth parameter"`

### Examples

✅ **Good**:
```typescript
{
	title: 'Find all callers of a function',
	description: 'Locate every place in the codebase where calculateTotal is called',
	parameters: {
		symbolName: 'calculateTotal',
		filePath: 'src/utils/math.ts',
		filterByRelationshipType: ['CALLS'],
		includeContext: true,
	},
	expectedOutcome: 'Returns all function call sites with context showing how calculateTotal is being called',
}
```

❌ **Bad**:
```typescript
{
	title: 'Example',
	description: 'Example usage',
	parameters: { query: 'test' },
}
```

## Validation

The registry automatically validates all definitions on startup:

```typescript
// Validation checks:
✓ Tool name is snake_case
✓ Description is 2-3 sentences (50-500 chars)
✓ 3-7 use case scenarios provided
✓ At least 2 examples with valid parameters
✓ Related tools exist in registry
✓ Required parameters present in examples
```

Run validation:
```bash
npm run build    # Validates during server startup
```

## Testing Your Definition

### 1. Check Compilation
```bash
npm run build
```

### 2. Verify Registration
Start the server and check logs:
```bash
npm start
# Look for: "Tool Registry initialized: Total tools: 22"
```

### 3. Test with MCP Inspector
```bash
npm run inspector
# Browse tool definitions in the UI
```

### 4. Check Validation
The registry runs validation on startup. Watch for:
- ✅ No validation errors
- ⚠️  Warnings are OK but should be addressed
- ❌ Errors prevent server startup

## Best Practices

### 1. Write for AI Agents

Remember that AI agents will read these definitions to understand how to use tools. Be explicit and clear.

### 2. Provide Real Examples

Use actual parameter values from real-world scenarios, not placeholders.

```typescript
// Good
parameters: {
	filePath: 'src/services/user.service.ts',
	includeReferences: true,
}

// Bad
parameters: {
	filePath: '<file path>',
	includeReferences: '<boolean>',
}
```

### 3. Map Intent to Action

In `whenToUse`, describe user intentions, not technical operations:

```typescript
// Good
'Finding all places where a function is called before refactoring it'

// Bad
'Tracing function references'
```

### 4. Explain the "Why"

Help AI understand not just what the tool does, but why to choose it over similar tools:

```typescript
description:
	'Use this tool when you need X. ' +
	'Unlike similar_tool, this one handles Y. ' +
	'For Z scenarios, use other_tool instead.',
```

### 5. Include Performance Guidance

Help AI make informed decisions:

```typescript
performanceNotes: [
	'Fast for queries with <100 results (<500ms)',
	'Queries involving many files may take 2-3 seconds',
	'Results cached for 5 minutes',
],
```

## Common Patterns

### Discovery Tools

Focus on: what can be found, search strategies, filtering options

```typescript
whenToUse: [
	'Finding where X is defined',
	'Exploring available Y',
	'Locating Z by pattern',
],
```

### Dependency Tools

Focus on: direction (forward/backward), depth, transitive relationships

```typescript
examples: [
	{
		title: 'Direct dependencies only',
		parameters: { depth: 1 },
	},
	{
		title: 'Deep dependency tree',
		parameters: { depth: 3, includeTransitive: true },
	},
],
```

### Impact Tools

Focus on: risk assessment, blast radius, recommendations

```typescript
whenToUse: [
	'Before refactoring to understand impact',
	'Planning breaking changes',
	'Verifying safe deletion',
],
```

### Architecture Tools

Focus on: system-level views, patterns, violations

```typescript
whenToUse: [
	'Understanding overall structure',
	'Identifying architectural issues',
	'Planning system-wide refactoring',
],
```

### Refactoring Tools

Focus on: code quality, patterns, optimization opportunities

```typescript
whenToUse: [
	'Finding duplicate code to consolidate',
	'Identifying refactoring candidates',
	'Understanding inheritance hierarchies',
],
```

## Troubleshooting

### Validation Errors

**Error**: "Tool name must be snake_case"
- ✅ Fix: Use `my_tool` not `myTool` or `my-tool`

**Error**: "Description should be 2-3 sentences"
- ✅ Fix: Expand single sentence to 2-3, or condense long paragraph

**Error**: "Missing required parameter in example"
- ✅ Fix: Ensure all required parameters appear in examples

### Server Won't Start

1. Check build output for TypeScript errors
2. Look for validation errors in server logs
3. Verify all imported definitions exist
4. Check for circular imports

### Examples Don't Match Schema

Ensure example parameters match inputSchema:
- Required parameters present
- Types match (string vs number vs boolean)
- Arrays have correct item types
- Enums use valid values

## Reference

### Complete Example

See `src/registry/tool-definitions/search-symbols.definition.ts` for a complete, well-documented example following all best practices.

### Validation Schema

See `McpToolDefinitionSchema` in `src/registry/McpToolDefinition.interface.ts` for the full Zod validation schema.

### Intent Discovery

AI agents can discover tools by intent using:

```typescript
import { suggestToolsForIntent } from './registry/tool-selector.js';

// AI searches for tools related to keywords
const tools = suggestToolsForIntent(['find', 'function', 'usage']);
// Returns: [trace_symbol_usage, search_symbols, ...]
```

---

**Questions?** Check existing tool definitions in `src/registry/tool-definitions/` for examples.