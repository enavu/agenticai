# enavu-hub

Self-hosted AI personal automation hub. Built entirely with Claude Code across 5 weeks — 4 weeks of architecture planning, ~9 hours of active coding.

**Live at [enavu.io](https://enavu.io)**

---

## What it does

| Feature | Description |
|---------|-------------|
| **Smart Home Chat** | Natural language → Claude ReAct agent → Home Assistant tool calls → 505 devices |
| **Fitness Tracking** | Playwright scraper pulls Cyclebar workout history (738 rides, 212k+ calories) |
| **Content Agent** | Workout data → AI-generated Instagram captions → auto-posted Tue/Thu |
| **Finance Tracker** | Private lease agreement tracker with auto-computed reliability scoring |
| **Agent Transparency** | Every agent run, tool call, and reasoning step logged and visible in UI |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   enavu.io (Caddy)                   │
│              Cloudflare → UniFi → Mac               │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌────────▼────────┐
    │   Next.js Frontend  │  │    Go API        │
    │   (TypeScript)      │  │   (Gin + asynq)  │
    └─────────────────────┘  └────────┬─────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               │                      │                       │
    ┌──────────▼──────┐   ┌──────────▼──────┐   ┌──────────▼──────┐
    │   PostgreSQL 16  │   │    Redis 7       │   │  Python Scraper  │
    │   (main store)   │   │  (asynq queues)  │   │   (Playwright)   │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               │                      │                       │
    ┌──────────▼──────┐   ┌──────────▼──────┐   ┌──────────▼──────┐
    │  Claude Sonnet   │   │  Home Assistant  │   │  Instagram API   │
    │  (ReAct agent)   │   │  (505 devices)   │   │  (Graph API)     │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Stack

**Backend:** Go 1.25 · Gin · asynq (Redis-backed job scheduler)
**Frontend:** Next.js 14 · TypeScript · Tailwind CSS
**Data:** PostgreSQL 16 · Redis 7
**AI:** Claude Sonnet 4.6 via Anthropic API · ReAct agent loop
**Scraping:** Python 3.12 · FastAPI · Playwright
**Infra:** Docker Compose · Caddy · Cloudflare · UniFi
**Hardware:** 2015 MacBook Pro (16GB RAM) · Raspberry Pi (Home Assistant)

---

## Services

```
services/
├── api/          Go API — handlers, ReAct agents, scheduler, store
├── frontend/     Next.js — dashboard, chat, workouts, posts, finance
└── scraper/      Python FastAPI — Playwright-based Cyclebar scraper
```

---

## How it was built

This was an experiment in **AI-native development** — not vibe-coding, but using Claude as an architectural collaborator.

- **Weeks 1–4:** Daily ~30 min planning sessions. Full system design, ADRs written, every decision documented before a single line of code.
- **Week 5:** Implementation. ~9 hours of active coding to bring it all to life.

The speed came from the upfront design. When you know exactly what you're building, the code writes itself.

---

## Running locally

```bash
cp .env.example .env
# fill in API keys (Claude, Home Assistant, Instagram)

make dev
# starts all 6 services via Docker Compose
```

Visit `http://localhost:3000`

---

## Key design decisions

- **Zero auth dependencies** — HMAC-SHA256 signed cookies, no libraries
- **ReAct loop from scratch** — no LangChain, no frameworks; think → act → observe in ~200 lines of Go
- **Single schema migration** — `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF NOT EXISTS` on startup, no migration tooling
- **Asynq for scheduling** — Redis-backed cron for daily scrapes and content posting

---

Built by [@enavu](https://github.com/enavu) with [Claude Code](https://claude.ai/claude-code)
