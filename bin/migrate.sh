#!/bin/sh
set -eu
export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="$DB_APP_NAME"
export PGPASSWORD="$DB_PASSWORD"
export PGDATABASE="$DB_APP_NAME"

# Wait for DB (cloudflared sidecar in Cloud Run, or direct in docker-compose)
for i in $(seq 1 30); do
  pg_isready -q 2>/dev/null && break
  [ "$i" -eq 30 ] && { echo "ERROR: DB not reachable after 30s" >&2; exit 1; }
  sleep 1
done

# pgschema natively supports \i directives for modular schema files
pgschema apply --file /app/schema/main.sql --auto-approve
echo "Migration complete."
