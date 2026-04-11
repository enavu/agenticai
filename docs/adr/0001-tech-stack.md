# ADR-0001: Technology Stack Selection

**Status:** Accepted
**Date:** 2026-04-10
**Author:** [@enavu](https://github.com/enavu)

---

## Context

Building a personal AI automation hub that serves two purposes:
1. A private utility to control a smart home (Home Assistant) and track fitness (Cyclebar)
2. A portfolio showcase demonstrating AI-native architecture and agentic engineering

The stack must reflect deliberate, professional choices that can be articulated in
an interview or design review.

## Decision

Go (Gin) for the API + agent orchestration, Python (Playwright) for browser scraping,
Next.js 14 (App Router) for the frontend, PostgreSQL + Redis for data and queuing,
Claude claude-sonnet-4-6 as the AI brain via Anthropic SDK.

## Rationale

| Layer | Chosen | Alternative | Reason |
|-------|--------|-------------|--------|
| API | **Go + Gin** | Node/Express, FastAPI | Existing Go expertise; static binaries; excellent concurrency for WebSocket hub |
| Scraper | **Python + Playwright** | Puppeteer (Node), Selenium | Best-in-class async browser automation; headless Chromium support |
| Frontend | **Next.js 14 App Router** | Remix, SvelteKit | Streaming SSR + Server Components for real-time agent step display |
| DB | **PostgreSQL 16** | SQLite, MongoDB | ACID guarantees for workout/agent run data; `pgx/v5` direct SQL |
| Queue | **Redis + asynq** | BullMQ, RabbitMQ | Simple; already a Redis dep for HA state cache |
| AI | **Claude claude-sonnet-4-6** | GPT-4o, Gemini | Tool use quality; extended thinking; consistent JSON schema adherence |
| Deploy | **Docker Compose** | K8s, Fly.io | Matches existing on-prem patterns; self-hosted |

## Consequences

- **Positive:** Each service is in its natural language for the task; clear service boundaries
- **Positive:** Docker Compose makes local dev and prod identical
- **Negative:** Two language runtimes (Go + Python) increase operational surface area
- **Neutral:** All services communicate via HTTP (REST) — simple but adds latency vs in-process

## Implementation Notes

- Go module path: `enavu-hub/api`
- Build with `GONOSUMDB=* GOFLAGS=-mod=mod` inside Docker (no pre-generated go.sum)
- Playwright runs in headless Chromium; manual lib installs needed on Debian Trixie
- Next.js must use `force-dynamic` + `cache: no-store` for Server Components that fetch live data
