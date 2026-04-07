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
- **共有 UI コンポーネント** (`client/src/components/`): Tailwind + CSS 変数によるカスタムデザインシステム
- **Feature ディレクトリ**: 各機能は `component.tsx` + `index.ts` + テスト + サブコンポーネントで構成
- **カスタムフック**: ビジネスロジックを `use*.ts` に抽出
- **状態管理**: テンプレートは `localStorage` (`useStorage`)、API データは SWR、認証は React Context
- **パスエイリアス**: `~/*` → `./src/*` (`client/tsconfig.json`)

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
