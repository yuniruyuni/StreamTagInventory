-- session row。ADR 0006 に従い、client は sessionStorage に raw 32B bearer token
-- を保管、リクエスト時に `Authorization: Bearer <raw>` で送信する。サーバは
-- `sha256(raw)` を token_hash 列と照合する (raw は DB に残さない)。
-- CSRF 対策は不要 (Authorization header は browser が自動付与しないため
-- cross-site attacker が被害者の認証情報を流用できない)。
CREATE TABLE sessions (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
-- token_hash の UNIQUE 制約が自動で BTREE index を作成するので追加 index は不要。
