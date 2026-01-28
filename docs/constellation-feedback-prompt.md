# Constellation Tool Design Feedback Request

## Context

You are a coding LLM with access to various tools for software development tasks. I'm developing an MCP (Model Context Protocol) tool called **Constellation** that provides AST-based code intelligence. The tool is designed specifically for LLMs like you to use for understanding codebases.

I want your honest, constructive feedback on whether this tool's design would effectively encourage you to use it proactively and appropriately.

---

## The Tool

**Name:** `query_code_graph`

**Description (what you'd see during tool selection):**

```
Query codebase structure and relationships via AST-based code intelligence graph. Understands symbols, dependencies, call hierarchies, and change impact—capabilities text search lacks.

USE THIS TOOL WHEN:
• Finding symbol definitions: "where is X defined", "find function Y"
• Tracing usage: "what calls X", "what imports this file"
• Dependency analysis: "what does X depend on", "show import tree"
• Change impact: "safe to modify X", "blast radius of changing Y"
• Code quality: "find unused exports", "dead code", "orphaned symbols"
• Architecture: "project structure", "how is this organized"

Write JavaScript using the `api` object. Start with `api.listMethods()` for all options. Key methods: searchSymbols, getDependents, getDependencies, impactAnalysis, findOrphanedCode. Always await. Use Promise.all() for parallel queries. Returns structured metadata—use Read tool for source code.
```

**Server Instructions (what you'd see at session start):**

````
<IMPORTANT>
The `query_code_graph` tool is designed for YOU, the coding LLM, as your primary tool for understanding code structure. Use it PROACTIVELY—don't wait for the human to ask. When you think "where is X defined?", "what calls this?", or "what would break?"—that's your cue to use `query_code_graph`, not Grep/Glob/Read.
</IMPORTANT>

# Constellation Code Mode

Write JavaScript with the `api` object to query the code intelligence graph.

## Quick Start
```javascript
const result = await api.searchSymbols({ query: "UserService" });
return result.symbols[0];
````

## Rules

1. **Always await** - All api.\* methods are async
2. **Return results** - Last expression auto-returned; use explicit `return` for control flow
3. **Use Promise.all()** - 3-10x faster for independent queries
4. **Use symbolId** - After search, use the returned `id` for precise follow-up queries

## Method Reference

| Method                         | Use For                |
| ------------------------------ | ---------------------- |
| `searchSymbols({query})`       | Find symbols by name   |
| `getSymbolDetails({symbolId})` | Full symbol info       |
| `getDependencies({filePath})`  | What this file imports |
| `getDependents({filePath})`    | What imports this file |
| `impactAnalysis({symbolId})`   | Change risk assessment |
| `findOrphanedCode()`           | Find unused exports    |
| `getArchitectureOverview()`    | Project structure      |
| `traceSymbolUsage({symbolId})` | All usages of symbol   |
| `getCallGraph({symbolId})`     | Call relationships     |
| `findCircularDependencies()`   | Import cycles          |

Run `api.listMethods()` for full API details. Read `constellation://types/api/{method}` for type definitions.

```

---

## Feedback Questions

Please provide your honest assessment:

### 1. Tool Selection
When you see this tool alongside Grep, Glob, and Read tools, would the name `query_code_graph` and description make you reach for it when:
- A user asks "where is the AuthService defined?"
- A user asks "what would break if I change this function?"
- You need to understand a codebase before making changes?

**What would make you MORE likely to choose this tool over text search?**

### 2. Activation Triggers
The description lists 6 categories of "USE THIS TOOL WHEN" triggers. Are these:
- Clear and recognizable when you encounter those intents?
- Missing any common scenarios where this tool would be valuable?
- Phrased in a way that maps to how users actually ask questions?

### 3. Proactive Usage Directive
The `<IMPORTANT>` block explicitly tells you to use this tool proactively. Does this:
- Actually influence your tool selection behavior?
- Feel like helpful guidance or unnecessary noise?
- Need stronger/weaker language?

### 4. Instructions Clarity
Are the server instructions:
- Clear enough to use the tool effectively on first attempt?
- Missing any critical information?
- Too verbose or appropriately concise?

### 5. API Design
Looking at the method reference, does the API:
- Map intuitively to common code understanding tasks?
- Have any confusing method names or parameters?
- Seem like it would produce useful results?

### 6. Barriers to Usage
What might prevent you from using this tool even when it would be appropriate?
- Uncertainty about when it's available/configured?
- Preference for familiar tools (Grep/Glob)?
- Unclear error handling or failure modes?
- Something else?

### 7. Suggested Improvements
If you could change ONE thing about this tool's presentation to make it more likely you'd use it appropriately, what would it be?

---

## Response Format

Please structure your feedback as:

1. **Overall Impression:** Would this tool design effectively encourage proactive use? (Yes/Partially/No)

2. **Strengths:** What works well about the current design?

3. **Weaknesses:** What might cause you to overlook or underutilize this tool?

4. **Specific Suggestions:** Concrete changes to name, description, triggers, or instructions

5. **Missing Elements:** Anything important that's not addressed?

---

Thank you for your candid feedback. This will directly inform improvements to help LLMs like yourself leverage code intelligence more effectively.
```
