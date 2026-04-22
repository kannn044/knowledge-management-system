# ════════════════════════════════════════════════════════
# KMS — Development convenience commands
# ════════════════════════════════════════════════════════

.PHONY: help up down build logs ps migrate seed shell-backend shell-python clean

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Dev environment ─────────────────────────────────────
up:  ## Start all services in development mode
	docker-compose up -d

down:  ## Stop all services
	docker-compose down

build:  ## Rebuild all images
	docker-compose build --no-cache

logs:  ## Tail logs from all services
	docker-compose logs -f

logs-backend:  ## Tail backend logs
	docker-compose logs -f backend

logs-python:  ## Tail python service logs
	docker-compose logs -f python-service

ps:  ## Show running services
	docker-compose ps

# ─── Database ────────────────────────────────────────────
migrate:  ## Run Prisma migrations
	docker-compose exec backend npx prisma migrate dev

migrate-prod:  ## Deploy migrations (production)
	docker-compose exec backend npx prisma migrate deploy

seed:  ## Seed database with initial data
	docker-compose exec backend npm run db:seed

studio:  ## Open Prisma Studio
	docker-compose exec backend npm run db:studio

# ─── Shells ──────────────────────────────────────────────
shell-backend:  ## Open shell in backend container
	docker-compose exec backend sh

shell-python:  ## Open shell in python-service container
	docker-compose exec python-service bash

shell-db:  ## Open PostgreSQL shell
	docker-compose exec postgres psql -U kms_user -d kms_db

# ─── Production ──────────────────────────────────────────
prod-up:  ## Start in production mode
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down:  ## Stop production services
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# ─── Cleanup ─────────────────────────────────────────────
clean:  ## Remove all containers and volumes
	docker-compose down -v --remove-orphans
