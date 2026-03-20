#!/bin/sh
set -eu

# Convention: owner user = ${DB_APP_NAME}, database = ${DB_APP_NAME}
export PGHOST=localhost
export PGPORT=5432
export PGUSER="$DB_APP_NAME"
export PGPASSWORD="$DB_PASSWORD"
export PGDATABASE="$DB_APP_NAME"

# Wait for cloudflared sidecar tunnel
for i in $(seq 1 30); do
  pg_isready -h localhost -p 5432 -q 2>/dev/null && break
  [ "$i" -eq 30 ] && { echo "ERROR: DB not reachable after 30s" >&2; exit 1; }
  sleep 1
done

# Run declarative migration (DDL only)
# App user DML GRANT is handled by NixOS ALTER DEFAULT PRIVILEGES
pgschema apply --file /app/db/schema.sql
echo "Migration complete."
