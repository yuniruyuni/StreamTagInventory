# docs/video — 紹介動画 (Remotion)

StreamTagInventory の紹介動画を Remotion で生成するサブプロジェクト。

## Tech Stack

- **Runtime/Package Manager:** Bun
- **動画生成:** Remotion 4
- **スクリーンショット撮影:** Playwright (本体アプリを起動して撮影)
- **出力:** MP4 (H.264) 1280x720 30fps

## Commands

```bash
bun install              # 依存インストール
bun run preview          # Remotion プレビュー (ブラウザで確認)
bun run render           # MP4 レンダリング → ../StreamTagInventory-Intro.mp4
bun run capture          # Playwright でスクリーンショット・動画素材を再生成
```

## Project Structure

```
docs/video/
├── capture-screenshots.ts   # Playwright テスト: スクリーンショット・動画撮影 + highlights.json 生成
├── playwright.config.ts     # Playwright 設定 (port 3100, chromium)
├── serve-for-capture.ts     # 撮影用の静的サーバー (本体の static/ を配信)
├── remotion.config.ts       # Remotion エントリーポイント設定
├── src/
│   ├── index.ts             # Remotion registerRoot
│   ├── Root.tsx             # Composition 定義 (1280x720, 30fps)
│   ├── IntroVideo.tsx       # メインコンポジション (シーン配置・セクションタイトル)
│   ├── scenes.ts            # 全シーン定義 (テキスト・背景・画像・動画・トランジション等)
│   ├── SceneRenderer.tsx    # シーン描画 (レイアウト: splitHighlight, splitPane, titleReveal 等)
│   ├── transitions.tsx      # トランジションエフェクト (push, flash, zoom, whip, glitch, flip, glow)
│   ├── highlights.json      # capture で自動生成されるハイライト座標 (percent-based)
│   ├── Slide.tsx            # スライド画像表示コンポーネント
│   └── slides.ts            # スライド定義
└── public/
    ├── yuniruyuni.png        # アバター画像
    ├── screenshots/          # capture で生成: main.png, card.png, login.png, etc.
    └── videos/               # capture で生成: dnd-reorder.webm, clone-template.webm, etc.
```

## Architecture

### 素材生成 (capture)

`capture-screenshots.ts` が Playwright で本体アプリ (port 3100) を操作し、以下を生成:
- **スクリーンショット** (`public/screenshots/`): ログイン画面、メイン画面 (3カード表示)、カード詳細、カテゴリDD等
- **操作動画** (`public/videos/`): DnD並べ替え、テンプレート複製、検索フィルタ
- **ハイライト座標** (`src/highlights.json`): UI要素の位置を percent-based rect で記録

撮影 viewport は **1600x900** (16:9)。本体アプリのカード幅 `w-96` (384px) は変更せず、3列表示を実現。

### Remotion コンポジション

`scenes.ts` の配列を `IntroVideo.tsx` が Sequence として配置。各シーンは `SceneRenderer.tsx` が描画。

- **レイアウト**: `splitHighlight` (スクリーンショット+ハイライト枠), `splitPane` (アイコン2分割), `titleReveal` (タイトル登場)
- **トランジション**: `transitions.tsx` で定義 (push, flash, zoom, whip, glitch, flip, glow, crossfade)
- **セクションタイトル**: `sectionTitle` プロパティで自動的にオーバーレイ表示

### BGM

現在 BGM は未設定。`public/` に wav ファイルを配置し `IntroVideo.tsx` に `<Audio>` を追加することで対応可能。

## Capture の仕組み

1. `playwright.config.ts` の webServer が本体アプリをビルド・起動 (`bun run e2e:build` → `serve-for-capture.ts`)
2. 各テストで `setupJapaneseMocks()` によりモックデータ (3テンプレート: Minecraft, Apex, VALORANT) を注入
3. スクリーンショット撮影後、`computeHighlight()` で UI 要素の座標を計算
4. 最終テスト `"write highlights.json"` で座標を JSON 出力

## Notes

- `highlights.json` は `bun run capture` で自動再生成される。手動編集不要。
- Remotion 出力は 1280x720、撮影素材は 1600x900 だがアスペクト比 16:9 で一致するためスケーリングに問題なし。
- `webServer.command` のパスは本体プロジェクトルートからの相対パス (`cd ../../..`)。
