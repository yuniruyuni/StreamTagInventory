#!/bin/sh
set -eu
export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="$DB_USER"
# Cloud Run の secret 値に末尾改行が含まれていると PGPASSWORD に そのまま乗り、
# PostgreSQL 認証で reject される (libpq は trim しない)。pgschema の Go client は
# whitespace を内部で trim するので過去は通っていたが、psql に揃えるため明示的に
# 改行を落とす。$(...) 末尾改行 strip + printf '%s' で内部改行 (なければ no-op) を保つ。
export PGPASSWORD="$(printf '%s' "$DB_PASSWORD")"
export PGDATABASE="$DB_NAME"

# Wait for DB (cloudflared sidecar in Cloud Run, or direct in docker-compose)
for i in $(seq 1 30); do
  pg_isready -q 2>/dev/null && break
  [ "$i" -eq 30 ] && { echo "ERROR: DB not reachable after 30s" >&2; exit 1; }
  sleep 1
done

# pgschema natively supports \i directives for modular schema files
pgschema apply --file /app/schema/main.sql --auto-approve
echo "Migration complete."
