# Deploy produzione

## Obiettivo

Usare una VM Proxmox con Docker, `docker-compose.prod.yml` e Nginx Proxy Manager davanti al container `web`.

## Primo deploy

1. `git clone <repo>`
2. `cd shift-complete`
3. `cp .env.production.example .env`
4. aggiorna almeno:
   - `JWT_SECRET`
   - `WEB_APP_URL`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `POSTGRES_DB`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `RESOURCE_STORAGE_DRIVER`
5. `make up`

Il frontend sara esposto sulla porta host `8080` per default. In Nginx Proxy Manager fai proxy verso `http://IP_VM:8080` e gestisci li SSL e dominio.

## Aggiornamento

Per aggiornare il deploy:

1. `make update`

Il target esegue:

- `git pull --ff-only`
- rebuild immagini
- restart dei container con `docker compose up -d --build --remove-orphans`

## Persistenza

I dati persistono nei volumi Docker:

- `postgres_data`: database PostgreSQL
- `redis_data`: Redis con AOF
- `s3_data`: oggetti MinIO
- `app_storage`: storage locale API se `RESOURCE_STORAGE_DRIVER=local`

Non usare `docker compose down -v` in produzione.

## Storage file

Hai due modalita:

- `RESOURCE_STORAGE_DRIVER=local`: i file restano nel volume `app_storage`
- `RESOURCE_STORAGE_DRIVER=s3`: i file vanno in MinIO usando `s3_data`

Per una VM singola vanno bene entrambe. Se vuoi meno coupling con il container API, usa `s3`.

## Seed e migrazioni

- `RUN_MIGRATIONS_ON_BOOT=true`: applica `prisma migrate deploy` all'avvio API
- `RUN_SEED_ON_BOOT=false`: lascia spento in produzione dopo il primo bootstrap

Se vuoi lanciare il seed manualmente:

- `make seed`

## Verifica rapida

- `make ps`
- `make logs`
- apri `http://IP_VM:8080`
- verifica `http://IP_VM:8080/api/logs/health`
