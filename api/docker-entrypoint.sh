#!/bin/sh
set -e

SEED_MARKER="/app/.db_initialized"

# Only run schema/seed on first startup
if [ ! -f "$SEED_MARKER" ]; then
  echo "Waiting for Postgres at $DATABASE_URL..."
  RETRIES=30
  until npx prisma migrate status >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo "Postgres not ready yet, retrying... ($RETRIES left)"
    RETRIES=$((RETRIES-1))
    sleep 2
  done

  echo "Generating Prisma client..."
  npx prisma generate

  echo "Applying database schema (first run)..."
  npx prisma db push

  if [ ! -f ./fixtures/customers.json ]; then
    echo "Generating fixture JSONs..."
    npm run seed:generate || true
  fi

  echo "Seeding database (first run)..."
  npm run db:seed || true

  echo "Marking database as initialized."
  touch "$SEED_MARKER"
else
  echo "Database already initialized — skipping schema push and seed."
fi

# Start app
exec "$@"
