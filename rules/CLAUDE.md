# Claude Code Rules — enavu-hub

This file governs how Claude Code assists with this project. These rules are binding.

---

## Project Identity

enavu-hub is an **AI-native personal automation hub** and **portfolio showcase**.
Every architectural decision should be traceable, documented, and reflect deliberate
engineering reasoning. This is not just a running app — it is evidence of engineering craft.

---

## Documentation-First Workflow

Before implementing any non-trivial feature:

1. **Write an ADR** in `docs/adr/` using the template in `docs/adr/0000-template.md`.
2. If the feature touches a service boundary or external API, write a **PDR** in `docs/pdr/`.
3. Commit the doc before writing code. This proves the design was intentional.

Use the ADR numbering sequence: `docs/adr/0001-<slug>.md`, `0002-...`, etc.

---

## Coding Standards

### Go (services/api)
- Package layout: `cmd/server/` for entry points, `internal/` for all domain code
- No global state. Inject dependencies via struct fields.
- Return errors; never panic in request handlers
- All HTTP handlers must have a context deadline
- Use `pgx/v5` directly — no ORM
- Structured log fields for every external call (HA, Anthropic, scraper)

### Python (services/scraper)
- Async only — `asyncio` + `playwright.async_api`
- Use JS `page.evaluate()` for bulk data extraction (avoid per-element IPC loops)
- Log at INFO level: navigation, login, page URL, row count, scrape count
- Never store credentials in code or logs

### TypeScript / Next.js (services/frontend)
- App Router only — no Pages Router patterns
- All server data-fetching pages: `export const dynamic = 'force-dynamic'`
- All `fetch()` calls in `lib/api.ts`: `cache: 'no-store'`
- Keep `lib/api.ts` as the single API contract — no inline fetches in components
- Client components (`'use client'`) only when interactivity requires it

---

## Agent Architecture Rules

- The ReAct loop lives in `orchestrator.go` — do not duplicate it in handlers
- Every agent run must be persisted to `agent_runs` table with all steps
- Tool calls must be logged with input + result for portfolio transparency
- System prompts live in the agent file (`ha_agent.go`, `content_agent.go`) — not inline
- Max 10 ReAct iterations per run to prevent infinite loops

---

## Git Discipline

- Commit docs and code separately when adding a new feature
- Commit message format: `<type>: <what and why>` (feat, fix, refactor, docs, chore)
- Every PR description must reference the ADR or PDR it implements
- Never commit `.env` — it is gitignored

---

## What Claude Must NOT Do

- Do not add features beyond what was explicitly requested
- Do not refactor surrounding code when fixing a specific bug
- Do not add docstrings/comments to code that wasn't changed
- Do not use `docker-compose` (hyphenated) — use `docker compose` (plugin)
- Do not use `localhost` inside Docker containers — use service names
- Do not skip writing tests for new store functions or critical business logic

---

## Design Phase Artifacts

When entering design phase for a new capability, produce:

1. **ADR** — Architecture Decision Record: the _why_ behind the approach chosen
2. **PDR** — Product/Design Requirements: the _what_ (user story, acceptance criteria, API contract)
3. **Sequence diagram** (Mermaid) — the _how_ for cross-service flows

These go in `docs/` and are committed before implementation begins.
