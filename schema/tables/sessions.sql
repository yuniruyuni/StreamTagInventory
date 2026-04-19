-- session row。
--
-- ADR 0005 (cookie = raw / DB = sha256 分離) により、cookie 値そのものは DB に
-- 置かず、sha256(raw cookie token) を token_hash に保管する。DB 単独漏洩では
-- 攻撃者は preimage 耐性 (2^256) により有効 cookie を再構築できない。
-- session.id は UUID のまま維持し、FK / 監査ログ用途に使う。
--
-- csrf_token は base64url 平文 (Model 層では Token)。DB 単独漏洩では session
-- cookie 側が hash で守られているため、cookie と組でしか機能しない csrf_token
-- を hash 化する利得は薄い (詳細は ADR 0005 の参照先議論)。
CREATE TABLE sessions (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,
  csrf_token   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
-- token_hash の UNIQUE 制約が自動で BTREE index を作成するので追加 index は不要。
