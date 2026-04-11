.PHONY: help dev prod build test clean logs ps

# Rancher Desktop ships `docker compose` (plugin); fall back to `docker-compose`
DOCKER := $(shell command -v docker 2>/dev/null || echo $(HOME)/.rd/bin/docker)
DOCKER_COMPOSE := $(shell $(DOCKER) compose version >/dev/null 2>&1 && echo "$(DOCKER) compose" || echo "docker-compose")

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Development ─────────────────────────────────────────────────────────────

dev: ## Start all services (docker compose up --build)
	@cp -n .env.example .env 2>/dev/null || true
	$(DOCKER_COMPOSE) up --build

dev-bg: ## Start all services in background
	@cp -n .env.example .env 2>/dev/null || true
	$(DOCKER_COMPOSE) up --build -d

stop: ## Stop all services
	$(DOCKER_COMPOSE) down

logs: ## Tail logs from all services
	$(DOCKER_COMPOSE) logs -f

logs-api: ## Tail API logs
	$(DOCKER_COMPOSE) logs -f api

logs-scraper: ## Tail scraper logs
	$(DOCKER_COMPOSE) logs -f scraper

logs-frontend: ## Tail frontend logs
	$(DOCKER_COMPOSE) logs -f frontend

ps: ## Show running containers
	$(DOCKER_COMPOSE) ps

# ─── API (Go) ────────────────────────────────────────────────────────────────

api-run: ## Run API locally (requires postgres + redis running)
	cd services/api && go run ./cmd/server/...

api-test: ## Run Go tests
	cd services/api && go test -v -race ./...

api-build: ## Build Go binary
	cd services/api && go build -o bin/server ./cmd/server/...

api-lint: ## Run Go linters
	cd services/api && go vet ./...

api-deps: ## Tidy Go modules
	cd services/api && go mod tidy

# ─── Scraper (Python) ────────────────────────────────────────────────────────

scraper-run: ## Run scraper locally
	cd services/scraper && uvicorn main:app --reload --port 8001

scraper-install: ## Install Python dependencies
	cd services/scraper && pip install -r requirements.txt

scraper-test: ## Test scraper endpoint
	curl -s http://localhost:8001/health | jq .

# ─── Frontend (Next.js) ──────────────────────────────────────────────────────

frontend-dev: ## Run Next.js dev server
	cd services/frontend && npm run dev

frontend-build: ## Build Next.js production
	cd services/frontend && npm run build

frontend-install: ## Install Node dependencies
	cd services/frontend && npm install

# ─── Database ────────────────────────────────────────────────────────────────

db-migrate: ## Run DB migrations
	$(DOCKER_COMPOSE) exec api ./server migrate

db-psql: ## Open psql shell
	$(DOCKER_COMPOSE) exec postgres psql -U enavu -d enavu_hub

# ─── Utilities ───────────────────────────────────────────────────────────────

health: ## Check API health endpoint
	curl -s http://localhost:8080/health | jq .

sync-workouts: ## Trigger manual Cyclebar scrape
	curl -s -X POST http://localhost:8080/api/v1/workouts/sync | jq .

generate-post: ## Trigger content agent manually
	curl -s -X POST http://localhost:8080/api/v1/posts/generate | jq .

clean: ## Remove build artifacts
	cd services/api && rm -rf bin/
	$(DOCKER_COMPOSE) down -v --remove-orphans

build: ## Build all Docker images
	$(DOCKER_COMPOSE) build

# ─── Production ───────────────────────────────────────────────────────────────

DOCKER_COMPOSE_PROD := $(DOCKER_COMPOSE) -f docker-compose.prod.yml

prod: ## Start in production mode (Caddy + SSL)
	$(DOCKER_COMPOSE_PROD) up --build -d

prod-stop: ## Stop production services
	$(DOCKER_COMPOSE_PROD) down

prod-logs: ## Tail production logs
	$(DOCKER_COMPOSE_PROD) logs -f

prod-rebuild: ## Rebuild and redeploy (use after git pull)
	$(DOCKER_COMPOSE_PROD) build --no-cache frontend api scraper
	$(DOCKER_COMPOSE_PROD) up -d
