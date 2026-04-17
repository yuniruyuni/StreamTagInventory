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
- **状態管理**: テンプレートは `localStorage` (`useStorage`)、API データは SWR、認証は React Context
- **パスエイリアス**: `~/*` → `./src/*` (`client/tsconfig.json`)

**新規 Repository / Usecase / Model を追加する前に必ず [`docs/architecture.md`](./docs/architecture.md) を読むこと**。Spec パターン / 標準メソッド / Pagination / Usecase phase / Result-Fail の規約をまとめてある。

## Theme Colors (`client/src/index.css`)

CSS 変数として定義。コンポーネントでは Tailwind クラス (`bg-surface`, `text-primary`, `border-border` 等) で参照する。
- `surface` / `surface-alt` / `surface-muted`: 背景色
- `primary` / `secondary` / `error`: アクセントカラー
- `on-surface` / `text-*` / `neutral-*`: テキスト・中立色
- `border` / `focus-ring`: ボーダー・フォーカス

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

### DB パスワードの使い分け

- **migration job**: `stream-tag-inventory-db-password` (owner user — DDL 権限が必要)
- **service**: `stream-tag-inventory-db-app-password` (app user — DML のみ)

混同すると migration が権限エラーで失敗するか、service に不要な DDL 権限が付与される。`-app-` サフィックスの有無で区別する。

### cloudflared サイドカー

DB アクセスは Cloudflare Tunnel 経由で `db.yuniruyuni.net` へ接続する。`cloudrun.yaml` と `cloudrun-job.yaml` の **両方** に `cloudflared` サイドカーが必要で、`cf-db-access-client-id` / `cf-db-access-client-secret` の secret を参照する。
