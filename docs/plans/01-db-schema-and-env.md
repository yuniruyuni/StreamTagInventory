# PR 1: DB schema + 環境変数準備

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」機能を 8 PR に分割した第 1 弾。共通設計・セキュリティモデル・既存パターンは [`00-overview.md`](./00-overview.md) にまとめている。**作業着手前に必ず 00-overview.md を一読すること**。

### この PR の目的
後続 PR の土台となる **DB スキーマ定義** と **環境変数の雛形追加**。コードは一切書かず、宣言的スキーマと yaml の雛形のみ。

- Backend は現状 `Repos = {}`, `appRouter = router({})` の空状態
- `schema/tables/` は `.gitkeep` のみで空
- 本 PR で 4 テーブル定義を追加し、後続 PR (Repository / Usecase / Router) が乗せられるようにする
- 環境変数も本 PR で雛形を作っておき、後続で値を埋める設計

### 設計の根拠
- **oauth_tokens / oauth_states テーブルは作らない** — サーバが Twitch トークンを保持しないため (ADR 0002 / 00-overview.md の「触れる/触れないもの」表参照)
- **`template_docs` テーブル (Yjs CRDT による local-first 同期)** — テンプレートおよびユーザー設定は 1 ユーザー 1 Y.Doc にまとめ、サーバは Y.Doc のバイナリ状態 (BYTEA) を保持するだけ。並び順・複数端末編集・オフライン対応がすべて CRDT に委譲される。詳細は [ADR 0004](../adr/0004-local-first-sync-with-yjs.md)
  - `position` 列は **存在しない** (Y.Array が並び順を保持)
  - `templates` / `user_settings` テーブルは **作らない** (旧計画から変更)
- **id_token の `preferred_username` claim** から `users.login` / `display_name` を取得するため、サーバから Twitch API を叩く必要がない (`/helix/users` 不要)
- 命名は CLAUDE.md の Cloud Run 規約 (`stream-tag-inventory-*` kebab-case) に準拠

### 後続 PR との関係
- PR 2 (Repository 層) がこのスキーマを参照
- PR 8 で `cloudrun.yaml` の secret env を完成させる (本 PR では雛形コメントのみ)

---

## タスク

### 1. `schema/tables/01_users.sql` を新規作成

**ファイル名に `01_` プレフィックスを付ける**: pgschema は `\i tables/` で alphabetical 順にロードするため、FK 参照される `users` が他の FK 参照元より先に読み込まれる必要がある。無印 `users.sql` だと `sessions.sql` / `template_docs.sql` が先に来て "relation users does not exist" で fail する (実測済)。

本 PR で唯一プレフィックスを付けるのは `users.sql` のみ。他のテーブルは FK 参照される側ではないのでそのままでよい (`oidc_nonces.sql` < `sessions.sql` < `template_docs.sql` のアルファベット順で `01_users.sql` の後に来る)。

```sql
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
```

**メモ**:
- `twitch_user_id` は Twitch の `sub` claim (文字列の数値表現)。文字列で扱う
- `login` / `display_name` は id_token の `preferred_username` から取得 (デフォルト `''` で空挿入後の更新を許す)
- `last_login_at` は `auth.login` ユースケースで毎回更新

### 2. `schema/tables/sessions.sql` を新規作成

```sql
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
```

**メモ**:
- `id` はアプリ側で `crypto.randomUUID()` 生成 (DEFAULT は付けない、推測不能性確保)
- `csrf_token` は base64url 32 bytes の文字列、session 生成時に同時発行
- `expires_at` は 30 日後 (`now() + interval '30 days'` をアプリ側で算出)
- ユーザー削除で session も自動削除 (`ON DELETE CASCADE`)

### 3. `schema/tables/oidc_nonces.sql` を新規作成

```sql
-- リプレイ攻撃防止のため発行した nonce を記録、1 度使ったら削除する
CREATE TABLE oidc_nonces (
  nonce      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX oidc_nonces_expires_at_idx ON oidc_nonces(expires_at);
```

**メモ**:
- `nonce` は base64url 32 bytes、サーバが `auth.startNonce` で発行
- `expires_at` は発行から 10 分後
- `auth.login` ユースケース内で `DELETE ... WHERE nonce = $1 RETURNING nonce` の atomic consume を行う (PR 2 の Repository で実装)

### 4. `schema/tables/template_docs.sql` を新規作成

```sql
-- Yjs CRDT ドキュメントを 1 ユーザー 1 行で保持する。
-- state はクライアントが生成した Y.Doc を Y.encodeStateAsUpdate でエンコードしたバイナリ。
-- テンプレート本体 (配列) と user_settings (postTemplate 等) は同じ Y.Doc 内に同居させるため、
-- 別途 templates / user_settings テーブルは作らない (ADR 0004 参照)。
CREATE TABLE template_docs (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state        BYTEA NOT NULL,
  size_bytes   INTEGER NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (size_bytes >= 0),
  CHECK (size_bytes <= 1048576)   -- 1 MiB 上限 (ユーザー単位のストレージ爆撃防止)
);
```

**メモ**:
- `state` は Yjs の update バイナリ (`Y.encodeStateAsUpdate(doc)` の結果)。PostgreSQL `BYTEA` に格納
- 1 ユーザー 1 行の制約は `PRIMARY KEY (user_id)` で表現 (spec は `{ userId }` 1 種類、list / count は使わない)
- `size_bytes` は state のバイト数を常に同期して書き込む。CHECK 制約で 1 MiB を超える書込みを DB 層で拒否
  - 1 MiB は「数千件のテンプレート + 適度な操作履歴」でも余裕のある値として選定。将来要件で調整
- 個別テンプレートの内部構造 (id / title / category / tags / 順序など) は Y.Doc 内部に保持。DB 側は中身をクエリしない (sync の際は state 丸ごと読み書き)
- ユーザー削除で doc も自動削除 (`ON DELETE CASCADE`)

**Y.Doc の想定トップレベル構造** (参考、実装は client / 検証は server):

```
doc
├─ Y.Array 'templates'     — Y.Map<Template> の配列
│   └─ Y.Map { id, title, categoryId, categoryName, categoryBoxArtUrl, tags: Y.Array<string> }
└─ Y.Map   'settings'      — Y.Map { postTemplate: string }
```

shape 検証 (トップレベルキーのホワイトリスト / サイズ上限 / 各フィールド型) は PR 5 (sync usecase) で実装する。

### 5. `schema/main.sql` の確認

既存の `schema/main.sql` (現状 `\i tables/`) で 4 ファイルが自動的に読み込まれることを確認。pgschema の挙動上、`tables/` 配下の `*.sql` は alphabetical 順で読み込まれる。FK 依存順は:

```
01_users.sql       → 依存なし   (プレフィックスにより最初にロード)
oidc_nonces.sql    → 依存なし
sessions.sql       → users
template_docs.sql  → users
```

ロード順は `01_users.sql` → `oidc_nonces.sql` → `sessions.sql` → `template_docs.sql` となり、`users` が必ず FK 参照元より先にロードされる。実測で `users.sql` (プレフィックス無し) だと `relation "users" does not exist` で fail することを確認済。

**確認手順**:
```bash
docker compose down -v
docker compose up -d postgres
# pgschema コンテナが migration を流すのを待つ
docker compose logs migration
# 4 テーブルが作成されたか確認
docker compose exec postgres psql -U twitch_tag_inventory -d twitch_tag_inventory -c '\dt'
```

### 6. `docker-compose.yml` に環境変数追加

`server` サービスの `environment` に以下を追加 (既存 `PGHOST`/`PGPORT`/`DB_APP_NAME`/`DB_PASSWORD` の隣):

```yaml
- TWITCH_CLIENT_ID=d2kz8x5se7k6b1n0picux0r7kaozi3   # 開発時は既存ハードコードと同じ値で OK、本番は別 app
- APP_BASE_URL=http://localhost:3000
```

**メモ**:
- `TWITCH_CLIENT_ID` は id_token の `aud` 検証用にサーバが知る必要がある
- 開発用 Twitch app を別に作成する場合は別値に差し替える (00-overview.md の「環境変数規約」参照)
- client への埋込み (`BUN_PUBLIC_TWITCH_CLIENT_ID`) は PR 6 で対応

### 7. `cloudrun.yaml` に環境変数雛形追加

`spec.template.spec.containers[0].env` に以下を追加 (既存の `DB_*` env 群の隣):

```yaml
- name: TWITCH_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: stream-tag-inventory-twitch-client-id
      key: latest
- name: APP_BASE_URL
  value: https://tags.yuniruyuni.net
```

**注意**:
- 本 PR ではこの yaml 変更だけ行い、**実際の `gcloud secrets create stream-tag-inventory-twitch-client-id` は PR 8 で実施**
- `APP_BASE_URL` は secret ではなく素の文字列 (公開情報、CDN/redirect 検証用)
- `cloudrun-job.yaml` (migration job 用) は env 追加不要 (Twitch 認証情報は migration には使わない)

### 8. `.env.example` を新規作成 (リポジトリ root)

開発者がローカルで動かすときの参考になる雛形を root に配置:

```bash
# Twitch OAuth
TWITCH_CLIENT_ID=d2kz8x5se7k6b1n0picux0r7kaozi3
APP_BASE_URL=http://localhost:3000

# Client build-time injection (PR 6 で使用)
BUN_PUBLIC_TWITCH_CLIENT_ID=d2kz8x5se7k6b1n0picux0r7kaozi3
BUN_PUBLIC_APP_BASE_URL=http://localhost:3000

# Database (既存)
PGHOST=localhost
PGPORT=5432
DB_APP_NAME=twitch_tag_inventory
DB_PASSWORD=twitch_tag_inventory
```

`.gitignore` に `.env.local` が入っていることを確認 (`.env.example` 自体は commit する)。

---

## テスト

本 PR はスキーマ + yaml のみのためユニットテストは無し。代わりに以下の手動確認を行う:

1. `docker compose down -v && docker compose up -d` でクリーン起動
2. migration job が成功すること (`docker compose logs migration` で `pgschema apply` が成功)
3. 4 テーブルが作成されていること:
   ```bash
   docker compose exec postgres psql -U twitch_tag_inventory -d twitch_tag_inventory -c '\dt'
   # 出力に users, sessions, oidc_nonces, template_docs の 4 行
   ```
4. 各テーブルのインデックスが作られていること:
   ```bash
   docker compose exec postgres psql -U twitch_tag_inventory -d twitch_tag_inventory -c '\di'
   ```
5. FK 制約・CHECK 制約が正しく設定されていること:
   ```bash
   docker compose exec postgres psql -U twitch_tag_inventory -d twitch_tag_inventory -c "\d sessions"
   docker compose exec postgres psql -U twitch_tag_inventory -d twitch_tag_inventory -c "\d template_docs"
   ```
6. `template_docs` の CHECK 制約動作確認 (`size_bytes = 1048577` 等の挿入が reject されること)

---

## Definition of Done

- [ ] `schema/tables/01_users.sql` 作成（FK 依存順確保のため `01_` プレフィックス必須）
- [ ] `schema/tables/sessions.sql` 作成
- [ ] `schema/tables/oidc_nonces.sql` 作成
- [ ] `schema/tables/template_docs.sql` 作成（`templates.sql` / `user_settings.sql` は作らない）
- [ ] `docker-compose.yml` に env 追加
- [ ] `cloudrun.yaml` に secret env 雛形追加
- [ ] `.env.example` を root に作成
- [ ] `docker compose down -v && docker compose up -d` でクリーン起動成功
- [ ] migration が成功し 4 テーブル + インデックス + FK/CHECK 制約が作られている
- [ ] `bun run check` 全緑 (TypeScript / Biome / test 全て)
- [ ] `bun run build` 成功
- [ ] PR description に「PR 1/8」と明記、後続 PR への依存方向 (このスキーマに依存する PR 2 が次) を記載
- [ ] PR description で ADR 0004 への準拠を明記し、`templates` / `user_settings` を作らない理由にリンクする

---

## 既知の落とし穴

- **pgschema の FK 依存順**: 実測すると `\i tables/` のアルファベット順で `sessions.sql` / `template_docs.sql` が `users.sql` より先にロードされて fail する。**必ず `users.sql` を `01_users.sql` にリネームする**。これは本 PR で確立済の要件
- `gen_random_uuid()` 関数は PostgreSQL 13+ で標準で使える (`pgcrypto` 不要)。docker-compose の `postgres:17` で動作確認済 想定
- Cloudflare Tunnel 経由の本番 DB (`db.yuniruyuni.net`) には本 PR ではアクセスしない (デプロイ時に `deploy.yml` 経由で migration job が走る)
- `cloudrun-job.yaml` を **編集しない** こと (migration job 側に Twitch 認証情報は不要)
- **`templates.sql` / `user_settings.sql` を「うっかり」復活させない**: 過去の PR 1 計画には存在したが ADR 0004 で撤廃済。レビュー時に該当ファイルが含まれていないことを確認
- `BYTEA` カラムに対する psql の表示は `\x` でバイナリダンプされる。中身をデバッグしたい場合は server 側で Y.Doc に decode する
