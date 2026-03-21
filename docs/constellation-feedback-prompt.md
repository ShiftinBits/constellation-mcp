# Constellation Tool Design Feedback Request

## Context

You are a coding LLM with access to various tools for software development tasks. I'm developing an MCP (Model Context Protocol) tool called **Constellation** that provides AST-based code intelligence. The tool is designed specifically for LLMs like you to use for understanding codebases.

I want your honest, constructive feedback on whether this tool's design would effectively encourage you to use it proactively and appropriately.

**Important:** The tool description and server instructions are NOT included in this prompt to avoid confusion with your actual MCP configuration. Instead, they will be provided to you via MCP as they would appear in a real session — in your tool list and server instructions. Evaluate them as you encounter them in that context.

---

## Pre-Evaluation Declaration

**Before answering any feedback questions**, you must formally declare your evaluation criteria:

### Your "Yes" Criteria

State the **specific, concrete conditions** that would cause you to answer **"Yes — this tool design effectively encourages proactive use"** in your Overall Impression. Be precise. For example:

- What must the tool name convey for you to select it over alternatives?
- What must the description contain for you to recognize when to use it?
- What must the server instructions provide for you to use it correctly on first attempt?
- What must the activation triggers cover for you to reach for it in the right situations?
- What must the API design look like for you to find it intuitive?

**Write these criteria FIRST**, then evaluate the tool against them. This prevents post-hoc rationalization and ensures your feedback is grounded in explicit standards.

---

## Feedback Questions

Please provide your honest assessment:

### 1. Tool Selection

When you see this tool alongside Grep, Glob, and Read tools, would the name and description make you reach for it when:

- A user asks "where is the AuthService defined?"
- A user asks "what would break if I change this function?"
- You need to understand a codebase before making changes?

**What would make you MORE likely to choose this tool over text search?**

### 2. Activation Triggers

The description lists categories of "USE THIS TOOL WHEN" triggers. Are these:

- Clear and recognizable when you encounter those intents?
- Missing any common scenarios where this tool would be valuable?
- Phrased in a way that maps to how users actually ask questions?

### 3. Proactive Usage Directive

The server instructions explicitly tell you to use this tool proactively. Does this:

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

1. **Pre-Evaluation Criteria:** Your declared "Yes" conditions (written before evaluating)

2. **Overall Impression:** Would this tool design effectively encourage proactive use? (Yes/Partially/No) — evaluated against your declared criteria

3. **Criteria Assessment:** For each criterion you declared, does the tool meet it? (Met/Partially Met/Not Met) with specific evidence

4. **Strengths:** What works well about the current design?

5. **Weaknesses:** What might cause you to overlook or underutilize this tool?

6. **Specific Suggestions:** Concrete changes to name, description, triggers, or instructions

7. **Missing Elements:** Anything important that's not addressed?

---

**Version evaluated:** 2026-01-28 — Tool description includes DECISION RULE, proactive triggers, error handling guidance, and ping() pre-flight. Server instructions include Top 3 Workflow, getCapabilities() pre-flight, performance note, query syntax guidance, empty-result diagnostics, cwd default clarification, Recovery Patterns, and pre-flight check in IMPORTANT block.

Thank you for your candid feedback. This will directly inform improvements to help LLMs like yourself leverage code intelligence more effectively.
