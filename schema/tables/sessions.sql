-- session row。csrf_token は CSPRNG 由来で HTTP header (`X-CSRF-Token`) に
-- base64url 文字列として乗るため、DB 側も同じ表現 (TEXT) で保持し境界変換を
-- 0 回にする。Model 層では Token として型づけ (server/src/models/common/token.ts)。
-- 機密性分析は ADR 0005 参照: session cookie との二段目防御なので、csrf_token
-- 単独漏洩ではなりすまし不成立。ハッシュ化は不要。
CREATE TABLE sessions (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
