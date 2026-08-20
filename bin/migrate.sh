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

# plan phase の向き先を対象 DB 自身にする。
#
# 渡さないと pgschema は **埋め込み PostgreSQL を起動** して desired state を
# 検証する。その実体は repo1.maven.org から 15 MB の jar を取る HTTP GET 1 回で、
# リトライが無く 200 以外はすべて "no version found matching <version>" になる
# (embedded-postgres v1.33.0 remote_fetch.go)。バージョンが無いという意味では
# なく取得に失敗したという意味しかない。StreamerPost の CI で実際に落ちた。
#
# 本番の apply は「対象 DB とローカル schema の差分」を見るだけなので、比較用の
# スキーマは対象 DB 内の一時スキーマで足りる。unit test (test/helpers/pgschema.ts)
# が既に同じ形で target DB 自身を plan に向けている。
export PGSCHEMA_PLAN_HOST="$PGHOST"
export PGSCHEMA_PLAN_PORT="$PGPORT"
export PGSCHEMA_PLAN_USER="$PGUSER"
export PGSCHEMA_PLAN_PASSWORD="$PGPASSWORD"
export PGSCHEMA_PLAN_DB="$PGDATABASE"

# Wait for DB (cloudflared sidecar in Cloud Run, or direct in docker-compose)
for i in $(seq 1 30); do
  pg_isready -q 2>/dev/null && break
  [ "$i" -eq 30 ] && { echo "ERROR: DB not reachable after 30s" >&2; exit 1; }
  sleep 1
done

# pgschema natively supports \i directives for modular schema files
pgschema apply --file /app/schema/main.sql --auto-approve
echo "Migration complete."
