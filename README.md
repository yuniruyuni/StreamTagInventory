# Stream Tag Inventory

Twitchストリーマー向けの配信設定管理ツールです。カテゴリとタグを効率的に管理し、配信設定を素早く切り替えることができます。

## 主な機能

- **ストリーミングテンプレートの管理**
  - 複数の配信テンプレート（タイトル、カテゴリ、タグのセット）を作成・保存
  - テンプレートの複製、編集、削除機能
  - ドラッグ＆ドロップでテンプレートの順序を変更可能

- **Twitchストリーム設定の適用**
  - 保存したテンプレートをワンクリックでTwitchストリームに適用可能
  - タイトル、カテゴリ、タグを一括設定
  - 適用時にストリームマーカーを作成（配信中の場合）

- **カテゴリ検索・選択機能**
  - Twitch APIを使用したカテゴリ（ゲーム）検索機能
  - カテゴリサムネイル表示とインクリメンタルサーチ

## 使い方

1. Twitchアカウントでログイン
2. 配信テンプレートを作成（タイトル、カテゴリ、タグを設定）
3. 複数のテンプレートを管理・整理
4. 配信前に適切なテンプレートを選択して「Apply」ボタンをクリック
5. 設定が即座にTwitchストリームに反映される

更に配信中の場合、現在の時刻にストリームマーカーが作成されます。これは配信の切り替えタイミングを後ほどTwitchのダイジェストツール上で確認するために役立ちます。

## 開発環境の使用方法

`bun run` サブコマンドを使用して、各種タスクを実行します。

```bash
# 依存関係のインストール
bun install

# ローカル開発サーバ起動 (docker compose で postgres + server 起動)
docker compose watch

# 全 check (type + lint + test + arch + e2e) 並列実行
bun run check

# 個別
bun run check:type
bun run check:lint
bun run check:test
bun run check:e2e
bun run fix:lint     # Biome auto-fix

# プロダクションビルド (client → static/, server → dist/server)
bun run build
```

### サードパーティライセンスページ

`bun run build`（および`bun run watch:run`）は、`client/package.json`と
`server/package.json`の本番依存を再帰的に調べ、lockfileに対応した
`client/static/third-party-licenses.html`を生成します。配信後は
`/third-party-licenses.html`で確認できます。

このHTMLと`THIRD_PARTY_NOTICES.md`のような一覧ファイルはビルド生成物であり、Gitには
コミットしません。CIとDocker image buildが毎回生成します。ライセンス本文を同梱していない
npmパッケージに限り、レビュー済みの入力を`scripts/license-overrides/`で管理します。

## 本番環境セットアップ

本アプリを Cloud Run にデプロイして運用するために必要な外部リソースとセットアップ手順。新規にクローンして自分のドメインで運用する開発者向け。

### 1. Twitch app 登録

1. [Twitch Developer Console](https://dev.twitch.tv/console/apps) で新規アプリケーション作成
2. **OAuth Redirect URLs**:
   - 開発用: `http://localhost:3000/`
   - 本番用: `https://<your-domain>/`
3. **Category**: `Application Integration`
4. 作成後の **Client ID** をメモ (OAuth 仕様上の公開値)

Client ID は以下 3 箇所に反映:
- `client/src/constant.ts` の `CLIENT_ID` デフォルト値 (ハードコード)
- `cloudrun.yaml` の `TWITCH_CLIENT_ID` env
- `.github/workflows/deploy.yml` の `build_args > BUN_PUBLIC_TWITCH_CLIENT_ID`

本番と開発で app を分ける場合、`BUN_PUBLIC_APP_BASE_URL` も含めて build-arg 経由で渡す。

### 2. Secret Manager (Google Cloud) 初期セットアップ

Cloud Run deploy に必要な Secret を Google Cloud Secret Manager に作成する。すべて **末尾改行を含めずに** 作成すること (code 側で trim する防御策は入っているが混乱の元)。

```bash
# DB パスワード (owner 権限、DDL 可。migration job が使用)
printf "%s" "<strong-random-32chars>" | \
  gcloud secrets create stream-tag-inventory-db-password --data-file=-

# app user パスワード (DML のみ。service が使用)
# 値は infra repo (yuniruyuni.net) の age secret と手動で一致させる必要がある。
# DB 側の user / GRANT / password set は NixOS 側で宣言的に管理されている。
printf "%s" "<another-random-32chars>" | \
  gcloud secrets create stream-tag-inventory-db-app-password --data-file=-

# Cloudflare Access Service Token (DB トンネル用)
printf "%s" "<cf-client-id>" | \
  gcloud secrets create cf-db-access-client-id --data-file=-
printf "%s" "<cf-client-secret>" | \
  gcloud secrets create cf-db-access-client-secret --data-file=-
```

Cloud Run service account に対して `roles/secretmanager.secretAccessor` を付与すること。

### 3. Cloudflare Cache Rule

Cloudflare proxy 経由で `https://<your-domain>/` を公開する場合、**`/api/*` を Bypass** するルールを設定する (未設定だと認証レスポンスが他ユーザーにキャッシュされる事故の可能性)。

1. Cloudflare Dashboard → 対象 Zone → **Caching** → **Cache Rules** → "Create rule"
2. **Rule name**: `Bypass /api/* cache`
3. **When incoming requests match**: `URI Path` `starts with` `/api/`
4. **Then**: **Cache eligibility** → `Bypass cache`
5. Save

server 側は `Cache-Control: no-store` + `Vary: Authorization` も併用しているが、Cloudflare 側で明示 Bypass するほうが確実。

### 4. Cloudflare Access (DB トンネル)

PostgreSQL は public IP を持たず、Cloud Run ↔ DB は Cloudflare Tunnel で接続する。

1. Cloudflare **Zero Trust** → **Access** → **Service Auth** → **Service Tokens** → "Create service token"
2. client ID / secret が発行されるので **Secret Manager に登録** (上記手順 2 の `cf-db-access-client-id` / `cf-db-access-client-secret`)
3. Cloudflare Tunnel で `db.<your-domain>` を内部 DB (`<db-host>:5432`) にマッピング
4. Cloud Run の `cloudrun.yaml` / `cloudrun-job.yaml` の `cloudflared` サイドカーに渡す `--hostname` を `db.<your-domain>` に合わせる

### 5. pgschema 初回適用

本番 DB に schema を初回適用する。`DROP TABLE IF EXISTS` などの破壊的操作が必要な場合は `bin/migrate.sh` の前段に一時的に psql コマンドを追加し、deploy 完了後に revert する (CLAUDE.md の「schema 変更の migration 落とし穴」参照)。

### 6. GitHub Actions secrets

`.github/workflows/deploy.yml` で Cloud Run に deploy するため、repo の Actions secrets に以下を登録:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

Workload Identity Federation を使う前提。サービスアカウントには `roles/run.admin` / `roles/artifactregistry.writer` / `roles/iam.serviceAccountUser` / `roles/secretmanager.secretAccessor` を付与する。

詳細な Cloud Run / DB / 認証フローの運用注意は [`CLAUDE.md`](./CLAUDE.md) を参照。
