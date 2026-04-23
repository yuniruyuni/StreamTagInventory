-- pgschema の plan DB で GRANT / ALTER DEFAULT PRIVILEGES の validation を通すため
-- だけに role を宣言する。pgschema の dump scope は指定 schema (= public) 配下の
-- オブジェクトに限定されるため、ここでの role 作成は plan DB でのみ意味を持ち、
-- target DB の diff plan には含まれない。target DB 側の role 定義・password・
-- 認証は infra repo (yuniruyuni.net/nixos/services/postgresql.nix) が source of truth。
--
-- ファイル名先頭の 000_ は schema/main.sql の `\i tables/` による alphabetical
-- ロード順で、後続の GRANT より先に role が作られることを保証するため。
--
-- DO block で冪等化する理由:
--   1. 本番 migration: pgschema の embedded plan DB は呼び出しごとに fresh なので
--      裸の CREATE ROLE でも通るが、
--   2. unit test: server/test/helpers/pgschema.ts が target DB 自体を --plan-host に
--      指定する構造で、target DB (embedded-postgres) の superuser が既に
--      stream_tag_inventory である場合に重複エラーが起きる。
-- どちらの環境でも動かすため IF NOT EXISTS ガードを入れる。
-- (PostgreSQL は CREATE ROLE IF NOT EXISTS を native にサポートしないため DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stream_tag_inventory') THEN
    CREATE ROLE stream_tag_inventory;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stream_tag_inventory_app') THEN
    CREATE ROLE stream_tag_inventory_app;
  END IF;
END
$$;
