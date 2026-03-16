# Documentazione sviluppatori

## Setup rapido

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev:api
npm run dev:web
```

Se Nx daemon fallisce in ambienti sandboxati con errore `listen EPERM`, usare:

```bash
NX_DAEMON=false npx nx build api
NX_DAEMON=false npx nx build web
```

## Setup Docker

```bash
cp .env.example .env
docker compose up --build
```

Servizi esposti:
- web: `http://localhost:4200`
- api: `http://localhost:3333/api`
- swagger: `http://localhost:3333/api/docs`
- postgres: `localhost:5432`
- redis: `localhost:6379`

Note Docker:
- il container `api` usa `postgres` e `redis` come hostname interni
- `postgres` e `redis` hanno healthcheck espliciti
- `api` parte solo quando i servizi infrastrutturali sono healthy
- all'avvio `api` esegue automaticamente `prisma db push`, poi `prisma:seed`, poi avvia NestJS
- la configurazione `docker compose` e stata verificata staticamente con `docker compose config`

## Convenzioni

- i tipi condivisi vivono in `libs/shared-types`
- i componenti foundation riusabili vivono in `libs/ui-kit`
- i moduli backend seguono una separazione per dominio, non per layer tecnico puro
- ogni feature critica deve produrre audit log
- scheduling, notifiche e collaboration usano Redis come supporto infrastrutturale

## Gap intenzionali della baseline

Questa base ora include:
- login JWT reale e hashing password PBKDF2
- guard globale JWT e RBAC a ruoli
- primi endpoint CRUD per team ed eventi con audit log
- query Prisma reali per utenti, team ed eventi

Restano da implementare:
- queue worker BullMQ effettivi
- upload file e storage S3 compatibile
- grafici PrimeNG reali e drag-and-drop operativo
- test automatici
- validazione runtime completa dopo installazione dipendenze e prima build Nx

Note feature UI/realtime:
- PrimeNG e ora integrato come provider globale nel frontend
- dashboard e calendario usano componenti PrimeNG reali
- backend websocket e broadcast eventi e pronto
- frontend live usa polling HTTP build-safe; il passaggio a `socket.io-client` puo essere fatto nel prossimo step

Questi elementi sono previsti dalla struttura gia generata.
