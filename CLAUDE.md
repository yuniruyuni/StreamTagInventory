# CLAUDE.md

## Project Overview

StreamTagInventory — Twitch 配信者向けのカテゴリ・タグ管理ツール。テンプレートを事前作成し、ワンクリックで配信設定を適用できる。

## Tech Stack

- **Runtime/Package Manager:** Bun (workspaces: client, server, e2e)
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **Backend:** Hono + tRPC + PostgreSQL
- **Linting/Formatting:** Biome (`biome.jsonc`)
- **Testing:** bun:test (unit), Playwright (e2e)
- **i18n:** i18next + react-i18next (ja/en)
- **DB Migration:** pgschema (declarative)
- **Deployment:** Docker (distroless) → Cloud Run

## Commands

```bash
bun run watch:run     # 開発サーバー起動（client bundle/tailwind + server --watch）
bun run build         # プロダクションビルド（client → static/, server → dist/server）
bun run check         # 全チェック並列実行（type + lint + test）
bun run check:type    # TypeScript 型チェック (全ワークスペース)
bun run check:lint    # Biome lint (全ワークスペース)
bun run check:test    # ユニットテスト (全ワークスペース)
bun run check:e2e     # Playwright e2e テスト
bun run fix:lint      # Biome auto-fix (全ワークスペース)
```

## Project Structure

```
├── package.json              # ワークスペースルート
├── biome.jsonc               # 共有 Biome 設定
├── docker-compose.yml        # ローカル開発（server + migration + postgres）
├── Dockerfile                # プロダクション（client build + server compile + distroless）
├── Dockerfile.migration      # pgschema migration
├── schema/
│   ├── main.sql              # pgschema エントリーポイント
│   └── tables/               # テーブル定義
│
├── client/                   # フロントエンド
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.tsx          # エントリーポイント
│       ├── index.css          # Tailwind @theme 定義
│       ├── components/        # 共有 UI コンポーネント
│       ├── api/               # Twitch API クライアント (SWR)
│       ├── model/             # ドメインモデル
│       ├── hooks/             # カスタムフック
│       ├── i18n/              # 翻訳設定 + locales
│       └── ...                # Feature ディレクトリ
│
├── server/                   # Hono + tRPC バックエンド
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # エントリーポイント
│       ├── context.ts         # コンテキスト構築
│       ├── infra/             # DB, Logger
│       ├── models/common/     # ID, Fail, Result, Cursor
│       ├── repositories/      # データアクセス層
│       ├── usecases/          # ユースケースランナー
│       └── presentation/      # Hono app + tRPC routers
│
└── e2e/                      # Playwright テスト
    ├── package.json
    ├── playwright.config.ts
    ├── *.spec.ts
    ├── scenarios/
    ├── screens/
    └── mocks/
```

## Architecture Patterns

- **Bun ワークスペース**: `client/` + `server/` + `e2e/` のモノレポ
- **Hono サーバー**: API + 静的ファイル配信を単一サーバーで処理（Nginx 廃止）
- **クリーンアーキテクチャ** (server): models → repositories → usecases → presentation
- **能力マーカー**: `DbReadCtx` / `DbWriteCtx` / `ServiceCtx` でリポジトリメソッドのスコープ制御
- **Repository は標準メソッド + spec object**: `findByXxx` 等を生やさず `get(spec)` / `list(spec, cursor)` / `count(spec)` / `upsert(model)` / `delete(spec)` のみ。詳細は `docs/architecture.md`
- **共有 UI コンポーネント** (`client/src/components/`): Tailwind + CSS 変数によるカスタムデザインシステム
- **Feature ディレクトリ**: 各機能は `component.tsx` + `index.ts` + テスト + サブコンポーネントで構成
- **カスタムフック**: ビジネスロジックを `use*.ts` に抽出
- **状態管理**:
  - テンプレート本体と postTemplate は **Y.Doc (Yjs CRDT) + y-indexeddb ローカル永続化 + tRPC でサーバ同期** ([ADR 0004](./docs/adr/0004-local-first-sync-with-yjs.md))。`client/src/sync/` に templateDoc / TemplateDocProvider / TRpcSyncProvider / useTemplates / usePostTemplate
  - Twitch API レスポンスは SWR
  - 認証 (Twitch identity) は `TwitchAuthProvider` で React Context 配信、id_token を sessionStorage + Bearer ([ADR 0007](./docs/adr/0007-stateless-jwt-bearer-no-server-session.md))
  - `localStorage` は PR 7 以前の旧テンプレートの rollback 用に 30 日残置 (`Migration/` で自動移行 + `cleanupLegacyStorage` で起動時削除)
- **パスエイリアス**: `~/*` → `./src/*` (`client/tsconfig.json`)

**新規 Repository / Usecase / Model を追加する前に必ず [`docs/architecture.md`](./docs/architecture.md) を読むこと**。Spec パターン / 標準メソッド / Pagination / Usecase phase / Result-Fail の規約をまとめてある。

## Architecture Decision Records (ADR)

横断的な設計判断（複数の選択肢から片方を選んだ経緯、将来の作業を制約する取り決め）は [`docs/adr/`](./docs/adr/) に ADR として記録する。

- 判断基準・ステータス・ファイル命名・作成フローは [`docs/adr/README.md`](./docs/adr/README.md) を参照
- 雛形は [`docs/adr/template.md`](./docs/adr/template.md)
- **既存 ADR の本文は書き換えず、判断を覆すときは新 ADR を書いて旧 ADR の `superseded_by` を更新** する
- 実装前に関連 ADR がないか確認し、`docs/plans/` や `docs/architecture.md` からは該当 ADR へリンクを張る

## Theme Colors (`client/src/index.css`)

CSS 変数として定義。コンポーネントでは Tailwind クラス (`bg-surface`, `text-primary`, `border-border` 等) で参照する。
- `surface` / `surface-alt` / `surface-muted`: 背景色
- `primary` / `secondary` / `error`: アクセントカラー
- `on-surface` / `text-*` / `neutral-*`: テキスト・中立色
- `border` / `focus-ring`: ボーダー・フォーカス

## 認証フロー (ADR 0007)

stateless JWT Bearer 方式。サーバー側に session / nonce 表は持たない。

1. client 起動 → `TwitchAuthProvider` が sessionStorage に id_token / access_token が居るか確認
2. 未ログイン: `crypto.randomUUID` で nonce を生成して `sessionStorage.oauth_nonce` に保管、Twitch OIDC authorize URL (implicit hybrid, `response_type=token id_token`) を用意して Entrance に表示
3. Twitch → localhost/#access_token=...&id_token=... でコールバック。client は id_token の `nonce` claim を sessionStorage の保存値と照合 (mix-up 防止)、成功したら `twitch-id-token` / `twitch-auth` を sessionStorage に保管
4. tRPC link が全リクエストに `Authorization: Bearer <id_token>` を付与、server は毎回 `jose.jwtVerify` で署名 / iss / aud / exp を検証して `sub` を UserContext.id に乗せる (DB I/O なし)
5. id_token の `exp` 失効 → 次の `auth.me` が 401 → provider の Phase B で sessionStorage を掃除して Entrance へ戻る

関連 ADR:
- [ADR 0002](./docs/adr/0002-server-does-not-hold-twitch-tokens.md) — Twitch トークンを DB に保存しない
- [ADR 0006](./docs/adr/0006-session-token-via-bearer-header.md) — session token を Authorization: Bearer (0007 で supersede 済、形は継承)
- [ADR 0007](./docs/adr/0007-stateless-jwt-bearer-no-server-session.md) — サーバ session 撤去、id_token を直接 Bearer に

DB 表は `template_docs` (Y.Doc バイナリ、PK = Twitch user id) **1 枚のみ**。users 表も ADR 0007 で撤去。

## 環境変数

### Server (Cloud Run `cloudrun.yaml` / `cloudrun-job.yaml` / docker-compose)

| env | 意味 | source |
|---|---|---|
| `TWITCH_CLIENT_ID` | id_token の `aud` 検証用。公開値なので平文 value | cloudrun.yaml の env 直書き |
| `APP_BASE_URL` | server 側参照用の自身の base URL。現状未使用だが server code に残る | cloudrun.yaml の env 直書き |
| `PGHOST` / `PGPORT` | libpq。production は cloudflared sidecar 経由で `localhost:5432` | cloudrun*.yaml 直書き (空なら default) |
| `DB_USER` / `DB_NAME` | DB ロール / DB 名。現状 `stream_tag_inventory` 単一ユーザー | cloudrun*.yaml 直書き |
| `DB_PASSWORD` | DB パスワード。**末尾改行込みで格納されている** ため code 側で trim (後述) | Secret Manager (`stream-tag-inventory-db-password`) |
| `SKIP_DB_VERIFY` | `=1` で起動時 `SELECT 1` 検証を skip。e2e / docker smoke 用 | CI ワークフロー env |

### Client (build-time 埋込)

`client/bin/build.ts` が `--define` で inline する allowlist キー。production deploy では `deploy.yml` が `build_args` で指定 (`.github/workflows/build-image.yml` 参照):

- `BUN_PUBLIC_TWITCH_CLIENT_ID`: authorize URL 構築用
- `BUN_PUBLIC_APP_BASE_URL`: redirect_uri 構築用 (production は `https://tags.yuniruyuni.net`)
- `NODE_ENV`: React の dev/prod 切替

**Dockerfile の ARG 同名 + build-arg 経由でしか production 値は入らない**。未指定だと `http://localhost:3000` が焼き込まれて Twitch redirect が壊れる。

## Cloudflare (production)

- **Cache Rule**: Cloudflare 側で `/api/*` Bypass を設定。origin の `Cache-Control: no-store` + `Vary: Authorization` が利かない場合 `api/*` が中間 CDN にキャッシュされ、他ユーザーに user 情報が混じる事故に繋がる
- **Insights beacon**: `static.cloudflareinsights.com/beacon.min.js` が Cloudflare プロキシで自動注入される。CSP の `scriptSrc` / `connectSrc` で許可済 (`server/src/presentation/index.ts`)
- **Access (DB Tunnel)**: Cloud Run → `db.yuniruyuni.net` は Cloudflare Access 経由のトンネル。cloudflared サイドカーが `cf-db-access-client-id` / `cf-db-access-client-secret` で認証

## Testing

- **Unit**: `client/src/**/*.test.ts(x)` — Happy DOM + Testing Library + bun-bagel (fetch mock)
- **E2E**: `e2e/*.spec.ts` — Playwright (chromium)。スナップショットは gitignore 対象、CI で再生成
- **E2E セレクタ**: `.navbar`, `button.avatar`, `.dropdown-content`, `.card` 等の識別クラスを使用

## CI (.github/workflows/)

- `ci.yml`: check:type → check:lint → check:test → build → check:e2e → docker
- `vrt.yml`: Visual Regression Testing (easy-vrt)
- `deploy.yml`: build-app + build-migration → migrate → deploy (Cloud Run)
- `schema-plan.yml`: PR 上で pgschema plan をコメント表示

## Cloud Run デプロイの注意点

今後の refactor で再発させてはいけない落とし穴。命名・環境変数・memory・パスワードの扱いを間違えるとデプロイが壊れる。

### 命名の一貫性

`deploy.yml` の `env.SERVICE_NAME` / `cloudrun.yaml` の `metadata.name` / `cloudrun-job.yaml` の `metadata.name` は 3 箇所で対応している必要がある。命名を変更する場合は 3 箇所同時に変更する。

- Service: `${SERVICE_NAME}` (= `stream-tag-inventory`)
- Migration Job: `${SERVICE_NAME}-migration` (= `stream-tag-inventory-migration`)

`deploy.yml` の `gcloud run jobs execute "${SERVICE_NAME}-migration"` で参照される名前と yaml の `metadata.name` が一致しないとデプロイが失敗する。

### memory の最低要件

Cloud Run **gen2 実行環境は合計 512Mi 以上の memory** が必須 (CPU always allocated の制約)。
`cloudrun-job.yaml` の migration container は明示的に `memory: "512Mi"` 以上を指定すること。`resources` ブロックを省略すると gen2 要件を満たさずにデプロイが失敗する。

### `PORT` 環境変数

`PORT` は **Cloud Run の予約環境変数** で、`containerPort` から自動注入される。`cloudrun.yaml` の `env` に `PORT` を追加してはいけない (起動失敗の原因)。
server 側は `process.env.PORT ?? 3000` で受け取るため、開発時は環境変数で上書き可能だが、本番 yaml では設定不要。

### DB 接続用の環境変数

server (`server/src/infra/db/index.ts`) / migration (`bin/migrate.sh`) は以下の env で接続情報を受け取る:

- `PGHOST` / `PGPORT`: libpq 標準。cloudflared サイドカー経由で `localhost:5432` を参照
- `DB_USER`: DB ロール名 (現状 service / migration 共に `stream_tag_inventory`)
- `DB_NAME`: データベース名 (同上)
- `DB_PASSWORD`: 下記のとおり owner / app user で secret を切り替える

`DB_USER` と `DB_NAME` を分離しているのは、将来 app user を owner と分ける際に user 名だけ差し替えられるようにするため。現状は同値でも env は別々に供給する。

### DB パスワードの使い分け

**現状**: `cloudrun.yaml` (service) / `cloudrun-job.yaml` (migration) の **両方が owner password** (`stream-tag-inventory-db-password`) を使っている。production DB に app user (DML 専用) が作成されていないため。`stream-tag-inventory-db-app-password` secret は値こそあるが対応する user が存在しないので失敗する (deploy 時にこれで躓いた経緯あり)。

**本来の意図 (TODO)**:
- migration job: `stream-tag-inventory-db-password` (owner — DDL 必要)
- service: `stream-tag-inventory-db-app-password` (app — DML のみ)

app user を DB 側に `CREATE USER + GRANT` で用意したら、service の cloudrun.yaml を app 側に切り替える。`-app-` サフィックスの有無で secret を区別する命名規約は維持する。

### DB_PASSWORD の末尾改行に注意

Secret Manager の `stream-tag-inventory-db-password` / `stream-tag-inventory-db-app-password` は **値の末尾に `\n` が含まれた形で格納** されている (33 bytes = 32 char + `\n`)。Cloud Run はそのまま env に注入するため、素の `PGPASSWORD` には改行が乗る。

- `pg` (Node) は改行を trim せず、認証で `"FATAL: password authentication failed"` になる
- 過去のデプロイが通っていたのは pgschema の Go client が内部で whitespace を trim していたため

対応: `server/src/infra/db/index.ts` および `bin/migrate.sh` の両方で、env から読んだ直後に `.replace(/[\r\n]+$/, "")` / `printf '%s'` で trim してから使う。secret 側を改行なしで再作成するのが根本だが、既存値を壊したくないため code 側で吸収する運用。

### cloudflared サイドカー

DB アクセスは Cloudflare Tunnel 経由で `db.yuniruyuni.net` へ接続する。`cloudrun.yaml` と `cloudrun-job.yaml` の **両方** に `cloudflared` サイドカーが必要で、`cf-db-access-client-id` / `cf-db-access-client-secret` の secret を参照する。

### schema 変更の migration 落とし穴

`schema/tables/` を declarative 編集して `pgschema` で反映する構造のため、**既存行がある状態で NOT NULL 列を追加すると migration が fail する**。具体的には:

- 新しい列を `NOT NULL` で追加 → 既存行の値を埋められず `ALTER TABLE ... ADD COLUMN ... NOT NULL` が ERROR
- 同様に型を互換性のない形に変える (TEXT → BYTEA など) も既存値で fail する可能性
- 列の型変更 (UUID ↔ TEXT 等) は pgschema が ALTER で差し替えようとしても既存値が cast できないと fail

対策 (先に検討すべき順):

1. **`DEFAULT` 付きで追加** — 安全かつ自動。値が意味を持たない時のみ使える (例: hash 列など "意味的に空" が許されない列には不向き)
2. **2 段階 migration** — PR を分けて NULL 許容で追加 → backfill → NOT NULL に変更
3. **`TRUNCATE <table>` / `DROP TABLE IF EXISTS` を deploy 前に実行** — ユーザーデータが失われてもよい段階 (pre-GA / session / nonce 等の ephemeral 表) でのみ許容。`bin/migrate.sh` の先頭に psql で書くのが定石。**deploy 成功後は即 revert** (残すと毎 deploy でデータが消える)

### 現スキーマ (ADR 0007 以降)

- `template_docs` — Y.Doc バイナリ。PK = `user_id TEXT` (Twitch user id 直接)
- それ以外の表は無し (ADR 0007 で `users` / `sessions` / `oidc_nonces` を撤去)

PR 4 時点の `sessions.token_hash NOT NULL` 追加では、production の `sessions` が空だったため migration が通った。同様の変更で行が既にある場合は上記のいずれかを選ぶこと。
