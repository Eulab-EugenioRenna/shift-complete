COMPOSE = docker compose --env-file .env

.PHONY: help up down

help:
	@printf '%s\n' \
	  'Targets:' \
	  '  make up   - start dev stack and rebuild web in watch mode' \
	  '  make down - stop dev stack'

up:
	@test -f .env || (printf '%s\n' '.env not found. Copy .env.example to .env first.' && exit 1)
	$(COMPOSE) up -d --build
	npx nx build web --watch

down:
	$(COMPOSE) down
