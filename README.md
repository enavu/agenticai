# enavu-hub

AI-driven personal automation hub — a portfolio showcase of multi-agent architecture built on real daily use.

## What it does

- **Smart Home Chat** — Natural language control of Home Assistant via a Claude-powered ReAct agent. Say "dim the living room and turn on rest mode" and watch the agent reason through two tool calls in real time.
- **Fitness Tracking** — Scrapes Cyclebar workout history with a Playwright microservice, stores it in Postgres, and surfaces stats on a dashboard.
- **AI Content Generation** — A scheduled content agent picks recent workouts, calls Claude to write an Instagram caption, and posts it via the Instagram Graph API — every Tuesday and Thursday.
- **Agent Transparency** — Every agent run (tool calls, reasoning steps, results) is logged and visible in the UI, making the architecture readable as a portfolio piece.

## Architecture

```
Browser ──HTTPS/WS──► Next.js (3000)
                          │
                    Go API Gateway (8080)
                    ├── REST handlers
                    ├── WebSocket hub (HA chat)
                    ├── Agent orchestrator (ReAct loop)
                    │   ├── HA Agent  ──► ha_tools
                    │   └── Content Agent ──► workout/ig/claude tools
                    └── Scheduler (asynq cron)

              PostgreSQL ← workouts, posts, agent_runs, conversations
              Redis       ← job queue + HA state pub/sub

External:
  Python scraper (8001) ──Playwright──► Cyclebar
  Home Assistant ──────────────────────► hotel89408.com:8123
  Instagram Graph API
  Anthropic API (claude-sonnet-4-6)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API + Agents | Go 1.25 · Gin · asynq |
| Scraper | Python 3.12 · FastAPI · Playwright |
| Frontend | Next.js 14 · TypeScript · Tailwind · shadcn/ui |
| Database | PostgreSQL 16 |
| Queue / Cache | Redis 7 |
| AI | Claude claude-sonnet-4-6 (Anthropic) |
| Deploy | Docker Compose |

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Fill in HA_TOKEN, ANTHROPIC_API_KEY, INSTAGRAM_*, CYCLEBAR_*

# 2. Start everything
make dev

# 3. Open
#   Frontend:  http://localhost:3000
#   API docs:  http://localhost:8080/health
```

## Key Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service health (DB, Redis, HA) |
| GET | `/api/v1/workouts` | Workout list + stats |
| POST | `/api/v1/workouts/sync` | Trigger Cyclebar scrape |
| GET | `/api/v1/home/state` | Current HA entity states |
| POST | `/api/v1/posts/generate` | Run content agent |
| GET | `/api/v1/agents/runs` | Agent run history |
| GET | `/api/v1/agents/runs/:id` | Full ReAct trace |
| WS | `/ws/chat` | HA chat (streaming agent steps) |

## Credentials Needed

| Credential | Where |
|---|---|
| `HA_TOKEN` | HA UI → Profile → Long-Lived Access Tokens |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `INSTAGRAM_ACCESS_TOKEN` | Facebook Developer Portal → Instagram Graph API |
| `CYCLEBAR_USERNAME/PASSWORD` | Your Cyclebar account |

## Agent Architecture

Both agents use a **ReAct loop**: Claude reasons about a goal, selects a tool, observes the result, and repeats until the task is complete. Every step is persisted to `agent_runs` in Postgres so you can replay the full trace later.

### HA Agent tools
`ha_get_state` · `ha_get_all_lights` · `ha_control_entity` · `ha_run_automation` · `ha_set_rest_mode` · `ha_get_history`

### Content Agent tools
`get_recent_workouts` · `get_ha_home_stats` · `generate_image_caption` · `post_to_instagram`

---

Built by [Ena Vujovic](https://enavu.io) · Powered by [Claude](https://anthropic.com)
