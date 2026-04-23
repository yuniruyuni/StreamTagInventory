-- pgschema の embedded plan DB で GRANT / ALTER DEFAULT PRIVILEGES の validation を
-- 通すためだけに role を宣言する。pgschema の dump scope は指定 schema (= public)
-- 配下のオブジェクトに限定されるため、ここでの CREATE ROLE は plan DB でのみ実行
-- され、target DB の diff plan には含まれない。target DB 側の role 定義・password・
-- 認証は infra repo (yuniruyuni.net/nixos/services/postgresql.nix) が source of truth。
--
-- ファイル名先頭の 000_ は schema/main.sql の `\i tables/` による alphabetical
-- ロード順で、後続の GRANT より先に role が作られることを保証するため。
CREATE ROLE stream_tag_inventory;
CREATE ROLE stream_tag_inventory_app;
