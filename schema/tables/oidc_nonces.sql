-- リプレイ攻撃防止のため発行した nonce を記録、1 度使ったら削除する
CREATE TABLE oidc_nonces (
  nonce      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX oidc_nonces_expires_at_idx ON oidc_nonces(expires_at);
