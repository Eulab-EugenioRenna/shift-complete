COMPOSE = docker compose -f docker-compose.prod.yml --env-file .env

.PHONY: help up update down restart logs ps pull build seed backup-db

help:
	@printf '%s\n' \
	  'Targets:' \
	  '  make up        - first deploy or rebuild prod stack' \
	  '  make update    - git pull + rebuild + restart prod stack' \
	  '  make down      - stop prod stack without removing volumes' \
	  '  make restart   - restart prod stack' \
	  '  make logs      - follow prod logs' \
	  '  make ps        - show prod containers' \
	  '  make pull      - git pull only' \
	  '  make build     - rebuild prod images only' \
	  '  make seed      - run seed manually inside api container' \
	  '  make backup-db - create Postgres dump in backups/'

up:
	@test -f .env || (printf '%s\n' '.env not found. Copy .env.example to .env first.' && exit 1)
	$(COMPOSE) up -d --build

update:
	@test -f .env || (printf '%s\n' '.env not found. Copy .env.example to .env first.' && exit 1)
	git pull --ff-only
	$(COMPOSE) up -d --build --remove-orphans

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

pull:
	git pull --ff-only

build:
	@test -f .env || (printf '%s\n' '.env not found. Copy .env.example to .env first.' && exit 1)
	$(COMPOSE) build

seed:
	$(COMPOSE) exec api npm run prisma:seed

backup-db:
	@mkdir -p backups
	$(COMPOSE) exec -T postgres pg_dump -U $${POSTGRES_USER:-shift} $${POSTGRES_DB:-shift_complete} > backups/postgres-$$(date +%Y%m%d-%H%M%S).sql
