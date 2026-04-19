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

# [一時的] ADR 0007 の破壊的スキーマ変更 (users 表撤去 + template_docs.user_id を
# UUID → TEXT) を pgschema が ALTER で適用できないため、対象テーブルを DROP して
# pgschema に再作成させる。pre-GA で実データは無いので破棄して問題ない
# (CLAUDE.md "schema 変更の migration 落とし穴" の選択肢 3 に相当)。
#
# ⚠️ deploy 成功後、この commit を revert すること。残しておくと次回 deploy 以降
# も毎回 template_docs が DROP されて Y.Doc が消える。
psql -c 'DROP TABLE IF EXISTS sessions CASCADE;'
psql -c 'DROP TABLE IF EXISTS oidc_nonces CASCADE;'
psql -c 'DROP TABLE IF EXISTS template_docs CASCADE;'
psql -c 'DROP TABLE IF EXISTS users CASCADE;'

# pgschema natively supports \i directives for modular schema files
pgschema apply --file /app/schema/main.sql --auto-approve
echo "Migration complete."
