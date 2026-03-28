# CLAUDE.md

## Project Overview

StreamTagInventory — Twitch 配信者向けのカテゴリ・タグ管理ツール。テンプレートを事前作成し、ワンクリックで配信設定を適用できる。

## Tech Stack

- **Runtime/Package Manager:** Bun
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **Linting/Formatting:** Biome (`biome.jsonc`)
- **Testing:** bun:test (unit), Playwright (e2e)
- **i18n:** i18next + react-i18next (ja/en)
- **Deployment:** Docker (Nginx alpine)

## Commands

```bash
bun run start     # 開発サーバー起動（backend + bundle + tailwind + test + type + lint 並列）
bun run build     # プロダクションビルド → static/
bun run type      # TypeScript 型チェック (tsc --noEmit)
bun run check     # Biome lint + format (--write)
bun run test      # ユニットテスト (bun:test)
bun run e2e       # Playwright e2e テスト
```

## Project Structure

```
src/
├── index.tsx              # エントリーポイント
├── index.css              # Tailwind @theme 定義（パレット制約 + アニメーション）
├── components/            # 共有 UI コンポーネント
│   ├── Button, Badge, Card, Input, Select, Link ...
│   ├── Navbar, Dropdown, MenuList, Avatar
│   └── SearchCombobox/    # ジェネリック検索コンボボックス <T>
├── api/                   # Twitch API クライアント (SWR 連携)
├── model/                 # ドメインモデル (Template, Category, User, Channel)
├── hooks/                 # カスタムフック (useChannelInfo, useTemplateOperations, ...)
├── i18n/                  # 翻訳設定 + locales/{en,ja}.json
├── MainScreen/            # メイン画面 (テンプレート一覧)
├── TemplateCard/          # テンプレートカード (フォーム + アクション + DnD)
├── CategorySelector/      # カテゴリ検索 (SearchCombobox<Category> ラッパー)
├── TwitchAuth/            # OAuth コンテキスト・プロバイダー
├── Notification/          # トースト通知システム
├── Menu/, Entrance/, CurrentStreamInfo/, InputTags/, ...
e2e/
├── *.spec.ts              # テストスイート (basic, authenticated, visual)
├── scenarios/             # シナリオ定義
├── screens/               # Page Object Model
└── mocks/                 # API モック
```

## Architecture Patterns

- **共有 UI コンポーネント** (`src/components/`): DaisyUI 不使用。Tailwind utility-first + パレット制約によるデザインシステム
- **Feature ディレクトリ**: 各機能は `component.tsx` + `index.ts` + テスト + サブコンポーネントで構成
- **カスタムフック**: ビジネスロジックを `use*.ts` に抽出
- **状態管理**: テンプレートは `localStorage` (`useStorage`)、API データは SWR、認証は React Context
- **パスエイリアス**: `~/*` → `./src/*` (`tsconfig.json`)

## Color Palette (`src/index.css`) — Utility-First Design

`@theme` で `--color-*: initial` により Tailwind デフォルトをリセットし、許可パレットのみ定義。
意味論的な名称（`primary`, `surface` 等）は使用禁止。パレット名のみ使用し、意味はコンポーネント側で付与する。

- **Slate** (50–800): 背景・テキスト・ボーダーの中立色（blue-tinted gray）
- **Blue** (50–800): プライマリアクション
- **Violet** (50–800): セカンダリアクション（CVD-safe, fuchsia の代替）
- **Red** (50–800): エラー・破壊的操作
- **Teal** (50–800): 成功通知（CVD-safe, green の代替）
- **Amber** (50–800): 警告通知
- **Purple** (300–700): visited リンク
- **White / Black**: 基本色

ボタン戦略: pale 背景 (200) + dark テキスト (800) + border (300) + hover (300)

## Testing

- **Unit**: `src/**/*.test.ts(x)` — Happy DOM + Testing Library + bun-bagel (fetch mock)
- **E2E**: `e2e/*.spec.ts` — Playwright (chromium)。スナップショットは gitignore 対象、CI で再生成
- **E2E セレクタ**: `.navbar`, `button.avatar`, `.dropdown-content`, `.card` 等の識別クラスを使用

## CI (.github/workflows/)

- `ci.yml`: type → lint → test → build → e2e
- `vrt.yml`: Visual Regression Testing (easy-vrt)
