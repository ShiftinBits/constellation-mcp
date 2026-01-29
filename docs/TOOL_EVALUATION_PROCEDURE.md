# Constellation MCP Tool Design Evaluation Procedure

This document defines a structured procedure for collecting tool design feedback from multiple AI CLI tools and synthesizing the results into a consolidated report.

---

## Purpose

The Constellation MCP server exposes a single `query_code_graph` tool designed for LLM consumption. To validate that the tool's name, description, activation triggers, and instructions effectively encourage proactive and appropriate use, we collect structured feedback from multiple AI CLI tools and compare their perspectives.

**Goals:**

- Determine whether the tool presentation encourages proactive use across different LLMs
- Identify consensus strengths and weaknesses in the tool design
- Surface concrete improvement suggestions from the tools themselves
- Produce an actionable report that informs tool design iterations

---

## Prerequisites

### Tools Installed

The following AI CLI tools must be installed and available on `$PATH`:

| Tool       | Install Reference                              | Verify Command    |
| ---------- | ---------------------------------------------- | ----------------- |
| `claude`   | [Claude Code](https://claude.ai/code)          | `claude --help`   |
| `codex`    | [OpenAI Codex CLI](https://github.com/openai)  | `codex --help`    |
| `copilot`  | [GitHub Copilot CLI](https://github.com/cli)   | `copilot --help`  |
| `gemini`   | [Google Gemini CLI](https://github.com/google) | `gemini --help`   |
| `kilocode` | [Kilocode CLI](https://kilocode.ai)            | `kilocode --help` |

### Feedback Prompt

The feedback prompt file must exist at:

```
constellation-mcp/docs/constellation-feedback-prompt.md
```

This file contains 7 structured feedback questions covering Tool Selection, Activation Triggers, Proactive Usage, Instructions Clarity, API Design, Barriers to Usage, and Suggested Improvements. Each tool receives the same prompt to ensure comparable responses.

### Working Directory

All commands in this procedure assume you are in the `constellation-mcp` root directory:

---

## Procedure

### Step 1: Create the Output Directory

Create the directory for captured feedback results:

```bash
mkdir -p ./temp/feedback-results
```

### Step 2: Run Each AI CLI Tool

Pipe the feedback prompt into each tool and capture the output.

**Claude:**

```bash
cat docs/constellation-feedback-prompt.md | claude > ./temp/feedback-results/claude-feedback.md
```

**Codex:**

```bash
cat docs/constellation-feedback-prompt.md | codex exec - > ./temp/feedback-results/codex-feedback.md
```

**Copilot:**

```bash
cat docs/constellation-feedback-prompt.md | copilot > ./temp/feedback-results/copilot-feedback.md
```

**Gemini:**

```bash
cat docs/constellation-feedback-prompt.md | gemini > ./temp/feedback-results/gemini-feedback.md
```

**Kilocode:**

```bash
cat docs/constellation-feedback-prompt.md | kilocode --auto > ./temp/feedback-results/kilocode-feedback.md
```

### Step 3: Review Individual Responses

Open each output file and verify that:

- The tool produced a substantive response (not an error or empty output)
- The response addresses all 7 feedback questions from the prompt
- The response follows the requested format (Overall Impression, Strengths, Weaknesses, Specific Suggestions, Missing Elements)

If a tool fails to produce output or returns an error, note it in the report and proceed with the remaining tools.

---

## Synthesis

After collecting all responses, synthesize them into a single consolidated report.

### Step 4: Compare Responses by Question

For each of the 7 feedback questions, compare what all 5 tools said:

1. **Tool Selection** — Would they choose `query_code_graph` over Grep/Glob? What would make them more likely to?
2. **Activation Triggers** — Are the 6 "USE THIS TOOL WHEN" categories clear? Any missing scenarios?
3. **Proactive Usage Directive** — Does the `<IMPORTANT>` block influence behavior? Too strong or too weak?
4. **Instructions Clarity** — Are the server instructions sufficient for first-use success?
5. **API Design** — Do the method names map intuitively to code understanding tasks?
6. **Barriers to Usage** — What would prevent them from using the tool when appropriate?
7. **Suggested Improvements** — What single change would each tool recommend?

### Step 5: Identify Consensus and Divergence

For each question, categorize the findings:

- **Consensus** — Points where 3+ tools agree (strong signal)
- **Divergence** — Points where tools disagree or raise unique concerns (worth investigating)
- **Unique insights** — Perspectives raised by only one tool that merit consideration

### Step 6: Write the Report

Create the final report at:

```
./temp/feedback-results/synthesis-report.md
```

Use the report template below.

---

## Report Template

```markdown
# Constellation Tool Design Feedback — Synthesis Report

**Date:** YYYY-MM-DD
**Evaluator:** [Name]
**Tools evaluated:** claude, codex, copilot, gemini, kilocode
**Feedback prompt:** `docs/constellation-feedback-prompt.md`

---

## Executive Summary

[2-3 sentence overview: Does the tool design effectively encourage proactive use?
What are the strongest signals from the feedback?]

---

## Overall Impressions

| Tool     | Rating (Yes / Partially / No) | Key Takeaway             |
| -------- | ----------------------------- | ------------------------ |
| claude   |                               |                          |
| codex    |                               |                          |
| copilot  |                               |                          |
| gemini   |                               |                          |
| kilocode |                               |                          |

---

## Question-by-Question Analysis

### 1. Tool Selection

**Consensus:**
[Points where 3+ tools agree]

**Divergence:**
[Points where tools disagree]

**Actionable findings:**
- [ ] ...

### 2. Activation Triggers

**Consensus:**
[Points where 3+ tools agree]

**Divergence:**
[Points where tools disagree]

**Actionable findings:**
- [ ] ...

### 3. Proactive Usage Directive

**Consensus:**
[Points where 3+ tools agree]

**Divergence:**
[Points where tools disagree]

**Actionable findings:**
- [ ] ...

### 4. Instructions Clarity

**Consensus:**
[Points where 3+ tools agree]

**Divergence:**
[Points where tools disagree]

**Actionable findings:**
- [ ] ...

### 5. API Design

**Consensus:**
[Points where 3+ tools agree]

**Divergence:**
[Points where tools disagree]

**Actionable findings:**
- [ ] ...

### 6. Barriers to Usage

**Consensus:**
[Points where 3+ tools agree]

**Divergence:**
[Points where tools disagree]

**Actionable findings:**
- [ ] ...

### 7. Suggested Improvements

**Consensus:**
[Points where 3+ tools agree]

**Divergence:**
[Points where tools disagree]

**Actionable findings:**
- [ ] ...

---

## Strengths (Consensus)

[Bullet list of design strengths that 3+ tools acknowledged]

## Weaknesses (Consensus)

[Bullet list of design weaknesses that 3+ tools identified]

## Unique Insights

| Tool     | Insight                        | Worth Pursuing? |
| -------- | ------------------------------ | --------------- |
|          |                                |                 |

---

## Recommended Changes

Priority-ordered list of changes based on the synthesis:

1. **[High]** ...
2. **[Medium]** ...
3. **[Low]** ...

---

## Raw Feedback References

| Tool     | File                                            |
| -------- | ----------------------------------------------- |
| claude   | `./temp/feedback-results/claude-feedback.md`    |
| codex    | `./temp/feedback-results/codex-feedback.md`     |
| copilot  | `./temp/feedback-results/copilot-feedback.md`   |
| gemini   | `./temp/feedback-results/gemini-feedback.md`    |
| kilocode | `./temp/feedback-results/kilocode-feedback.md`  |
```

---

## Notes

- The `./temp/` directory is gitignored. Feedback results are session artifacts, not committed to the repository.
- If a tool requires additional flags (e.g., `--no-interactive`, `--stdin`) to accept piped input, adjust the command accordingly.
- Some tools may require authentication or API keys configured before they will produce output. Ensure each tool is operational before starting the procedure.
