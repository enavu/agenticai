# ADR-0002: ReAct Agent Loop for AI Orchestration

**Status:** Accepted
**Date:** 2026-04-10
**Author:** [@enavu](https://github.com/enavu)

---

## Context

The app needs Claude to autonomously control Home Assistant and generate Instagram
content from workout data. The AI must be able to call tools (API calls, database
reads, external services), observe results, and reason about what to do next —
potentially across multiple steps.

## Decision

Implement a **ReAct (Reason + Act) loop** in `orchestrator.go` using the Anthropic
Messages API with tool use. Each agent run is persisted step-by-step to PostgreSQL
and streamed to the frontend via WebSocket.

## Rationale

| Approach | Pros | Cons |
|----------|------|------|
| **ReAct loop (chosen)** | Transparent; each step visible; handles multi-step tasks; well-understood pattern | More complex than single-shot |
| Single-shot prompt | Simple; fast | Cannot handle tasks requiring multiple tool calls; black box |
| LangChain/LlamaIndex | Pre-built agent abstractions | Opaque; adds heavy dependency; hides the architecture |
| Function-calling only | Simple; deterministic | No reasoning chain; no multi-step planning |

ReAct was chosen because:
1. **Portfolio value**: Every think/act/observe step is logged and visible — the AI's
   reasoning is transparent, which demonstrates understanding of how agents work
2. **Correctness**: Home Assistant control often requires multiple steps
   (e.g., "dim all lights and activate rest mode" = 3+ tool calls)
3. **Industry standard**: ReAct is the canonical agentic pattern; demonstrating it
   shows familiarity with agentic AI engineering

## Consequences

- **Positive:** Full observability — every agent run has a complete trace in `agent_runs` table
- **Positive:** Easy to add new tools by registering them in `tools/registry.go`
- **Negative:** More tokens consumed per interaction than single-shot
- **Negative:** Latency scales with number of reasoning steps

## Implementation Notes

```
orchestrator.go flow:
  1. Build messages array with system prompt + user input
  2. Call Anthropic Messages API with tool definitions
  3. If response has tool_use blocks → execute tools → append results → go to 2
  4. If response is text → done, persist final output
  5. Max 10 iterations to prevent runaway loops
```

Tool results use `anthropic.NewToolResultBlock(id, result, false)`.
Each step is appended to `AgentRun.Steps` and upserted to DB.
The WebSocket hub broadcasts step updates to connected clients.

See: `internal/agent/orchestrator.go`, `internal/agent/tools/registry.go`
