CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twitch_user_id  TEXT NOT NULL UNIQUE,
  login           TEXT NOT NULL DEFAULT '',
  display_name    TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_twitch_user_id_idx ON users(twitch_user_id);
