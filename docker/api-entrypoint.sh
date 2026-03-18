#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS_ON_BOOT:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

if [ "${RUN_SEED_ON_BOOT:-false}" = "true" ]; then
  npm run prisma:seed
fi

exec node dist/apps/api/main.js
