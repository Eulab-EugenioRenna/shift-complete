# Architettura

## Monorepo

- `apps/web`: Angular PWA con shell per ruolo, dashboard KPI, calendario, onboarding, inventario, risorse, settings
- `apps/api`: NestJS modulare con API REST, WebSocket e servizi di dominio
- `libs/shared-types`: contratti comuni tra web e api
- `libs/ui-kit`: token grafici e component foundation condivisi
- `prisma`: schema PostgreSQL e seed iniziale

## Bounded contexts

- Auth e RBAC
- Teams e membership
- Events e ricorrenze
- Scheduling automatico e sostituzioni
- Inventory e strumenti
- Resources file manager
- Notifications
- Realtime collaboration
- Logging e audit
- AI settings provider-agnostic
- Export e integrazioni calendario

## Regole di visibilita

- Amministratore: accesso globale
- Leader di servizio: vede e modifica solo team/eventi del proprio servizio
- Volontario: vede solo turni, onboarding, preferenze e notifiche personali

## Scheduling engine

Input previsti:
- disponibilita volontario
- skill e ruoli abilitati
- vincoli di riposo
- equita storica
- ricorrenze evento
- priorita team e copertura minima
- richieste di sostituzione

Output previsti:
- proposta turni automatica
- spiegazione criteri di assegnazione
- audit dei cambiamenti
- notifiche e collaborazione realtime per revisioni

## Persistenza e infrastruttura

- PostgreSQL: sorgente di verita transazionale
- Redis: cache, queue BullMQ, pub/sub websocket e lock distribuiti
- Prisma: schema e migrazioni
- Docker Compose: ambiente locale completo
