-- リプレイ攻撃防止のため発行した nonce を記録、1 度使ったら削除する。
-- nonce は OIDC 仕様上 HTTP 境界で base64url 文字列として流れるため、DB 側も
-- 同じ表現 (TEXT) で保持し境界変換を 0 回にする。Model 層では Token として
-- 型づけしつつ内部表現は base64url string (server/src/models/common/token.ts)。
-- 機密性分析は ADR 0005 参照: Twitch 署名鍵 + 10min TTL + atomic consume で
-- 防御しており、DB 平文で保存しても単独での悪用経路は無い。
CREATE TABLE oidc_nonces (
  nonce      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX oidc_nonces_expires_at_idx ON oidc_nonces(expires_at);
