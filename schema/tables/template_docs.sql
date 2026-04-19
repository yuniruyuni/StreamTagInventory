-- Yjs CRDT ドキュメントを 1 ユーザー 1 行で保持する。
-- state はクライアントが生成した Y.Doc を Y.encodeStateAsUpdate でエンコードしたバイナリ。
-- テンプレート本体 (配列) と user_settings (postTemplate 等) は同じ Y.Doc 内に同居させるため、
-- 別途 templates / user_settings テーブルは作らない (ADR 0004 参照)。
--
-- ADR 0007 以降、user_id は Twitch user id (id_token の sub claim) を直接 PK として
-- 使う (users 表を撤去)。サーバは JWT を毎リクエスト署名検証するだけで identity を
-- 決定するため、内部 UUID 層は不要。
CREATE TABLE template_docs (
  user_id      TEXT PRIMARY KEY,
  state        BYTEA NOT NULL,
  size_bytes   INTEGER NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT template_docs_size_bytes_non_negative CHECK (size_bytes >= 0),
  CONSTRAINT template_docs_size_bytes_max          CHECK (size_bytes <= 1048576)
);
