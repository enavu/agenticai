#!/bin/bash
# deploy.sh — build and start enavu-hub in production mode
set -e

DOCKER="${HOME}/.rd/bin/docker"
COMPOSE="${DOCKER} compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "→ Pulling latest code..."
git pull origin main

echo "→ Building images (with prod env)..."
${COMPOSE} build --no-cache frontend api scraper

echo "→ Starting all services..."
${COMPOSE} up -d

echo "→ Status:"
${COMPOSE} ps

echo ""
echo "✓ enavu-hub is running"
echo "  Local:  http://localhost:3000"
echo "  Public: https://enavu.io  (once DNS + port forwarding are set)"
