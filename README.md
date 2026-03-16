# Shift Complete

SaaS per la gestione di turni, eventi, team, inventario e risorse per organizzazioni di volontariato.

## Stack

- Nx monorepo
- Angular 19 PWA + Tailwind 4 + PrimeNG 19
- NestJS 11 API + WebSocket
- PostgreSQL + Prisma
- Redis per cache, queue e collaboration realtime
- Docker e Docker Compose

## Applicazioni

- `apps/web`: frontend Angular con dashboard, calendario, onboarding e moduli per ruolo
- `apps/api`: backend NestJS con domini modulari, auth RBAC, websocket, logging e scheduling
- `libs/shared-types`: tipi condivisi frontend/backend
- `libs/ui-kit`: direzione UI condivisa, token e componenti base

## Ruoli

- `administrator`: visione completa, crea team, nomina leader, configura sistema
- `service_leader`: vede e gestisce solo eventi e assegnazioni del proprio servizio
- `volunteer`: vede solo i propri turni, onboarding e notifiche personali

## Avvio locale

1. `cp .env.example .env`
2. `npm install`
3. `npm run prisma:generate`
4. `npm run prisma:migrate`
5. `npm run prisma:seed`
6. `npm run dev:api`
7. `npm run dev:web`

## Avvio con Docker

1. `cp .env.example .env`
2. `docker compose up --build`

Docker esegue automaticamente:
- attesa database
- `prisma db push`
- seed idempotente dell'amministratore e dati base

La documentazione completa è in `docs/`.
