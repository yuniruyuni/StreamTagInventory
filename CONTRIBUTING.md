# コントリビューションガイド

> [English version](CONTRIBUTING.en.md)

StreamTagInventory へのコントリビューションに興味を持っていただきありがとうございます！このドキュメントでは、開発環境のセットアップから PR がマージされるまでの流れを説明します。

## 開発環境のセットアップ

### 前提条件

- [Bun](https://bun.sh/) v1.3 以上

### インストール・起動

```bash
# リポジトリをフォークし、クローン
git clone https://github.com/<your-username>/StreamTagInventory.git
cd StreamTagInventory

# 依存関係のインストール
bun install

# 開発サーバーの起動（backend + bundle + tailwind + test + type + lint 並列）
bun run start
```

## 開発ワークフロー

1. リポジトリを Fork する
2. ブランチを作成する（命名規約は下記参照）
3. 変更をコミットする
4. Fork 先にプッシュする
5. Pull Request を作成する

### ブランチ命名規約

`type/description` 形式を使用してください。

| type       | 用途               |
| ---------- | ------------------ |
| `feat`     | 新機能             |
| `fix`      | バグ修正           |
| `docs`     | ドキュメント変更   |
| `refactor` | リファクタリング   |
| `test`     | テスト追加・修正   |
| `chore`    | その他の雑務       |

例: `feat/add-tag-filter`, `fix/template-save-error`

## コーディング規約

- **Lint / Format**: [Biome](https://biomejs.dev/) を使用（設定は `biome.jsonc`）
  - `bun run check` で lint + format を自動修正
- **TypeScript**: strict モード有効
- **パスエイリアス**: `~/*` → `./src/*`（`tsconfig.json` で定義）
- **テーマカラー**: `src/index.css` の CSS 変数を使用し、Tailwind クラス（`bg-surface`, `text-primary`, `border-border` 等）で参照する

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/ja/) の使用を推奨します（必須ではありません）。

```
type: 変更内容の要約

# 例
feat: タグフィルター機能を追加
fix: テンプレート保存時のエラーを修正
docs: CONTRIBUTING.md を追加
```

主な type:

| type       | 用途               |
| ---------- | ------------------ |
| `feat`     | 新機能             |
| `fix`      | バグ修正           |
| `docs`     | ドキュメント変更   |
| `refactor` | リファクタリング   |
| `test`     | テスト追加・修正   |
| `chore`    | その他             |
| `ci`       | CI 設定変更        |

## テスト

PR を作成する前に、以下の 4 コマンドがすべて成功することを確認してください。

```bash
bun run type    # TypeScript 型チェック
bun run check   # Biome lint + format
bun run test    # ユニットテスト
bun run e2e     # Playwright e2e テスト
```

- ユニットテスト: `src/**/*.test.ts(x)` — Happy DOM + Testing Library
- E2E テスト: `e2e/*.spec.ts` — Playwright (Chromium)

## Pull Request

- **タイトル**: Conventional Commits 形式を推奨（例: `feat: タグフィルター機能を追加`）
- **CI**: すべてのチェック（type → lint → test → build → e2e）が通ることを確認してください
- **VRT**: Visual Regression Testing の差分がある場合は、意図した変更かどうか確認してください
- **マージ方針**: Squash merge で取り込みます

## i18n（国際化）

- UI テキストは直接ハードコードせず、i18next の翻訳キーを使用してください
- 新しいキーを追加する場合は、`src/i18n/locales/en.json` と `src/i18n/locales/ja.json` の両方に追加してください
