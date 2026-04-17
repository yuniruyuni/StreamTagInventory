# PR 8: E2E 修正 + Cloud Run secret + ドキュメント + cleanup

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」シリーズの最終回 (第 8 弾)。共通設計・セキュリティモデルは [`00-overview.md`](./00-overview.md) を参照。

### 前提
- PR 1〜7 で本機能の実装は全て完了
- Backend (tRPC) と Frontend (tRPC client + auth provider + 移行 UI) が動作している
- 本番デプロイ前の最終整備フェーズ

### この PR の目的
1. **E2E (Playwright) テストの修正**: 既存テストを Cookie ベース認証に書き換え
2. **本番シークレットの登録**: `gcloud secrets create stream-tag-inventory-twitch-client-id` 手順を README に追加
3. **Cloudflare Cache Rule の設定手順**: ダッシュボード操作を README に明記
4. **CLAUDE.md の更新**: 新フロー / 環境変数 / Twitch app 登録手順を追記
5. **localStorage cleanup**: 移行から 1 ヶ月経過したユーザーの旧 localStorage データ削除を起動時実行
6. **GitHub Actions の env 注入**: client build 時に `BUN_PUBLIC_TWITCH_CLIENT_ID` / `BUN_PUBLIC_APP_BASE_URL` を埋め込む

### 後続
- 本 PR 完了で本機能はリリース可能
- 後日: passive theft 対策の運用層強化 (Cloudflare DNS, 証明書監視) は CLAUDE.md に推奨事項として記載 (実装範囲外)

---

## タスク

### 0. 既存コードの確認

実装前に以下を読むこと:
- `e2e/playwright.config.ts` — Playwright 設定
- `e2e/scenarios/` 配下の既存 spec
- `e2e/screens/` の Page Object
- `e2e/mocks/` の Twitch API mock パターン
- `cloudrun.yaml` — secret env 雛形 (PR 1 で追加済)
- `.github/workflows/deploy.yml` — デプロイフロー
- `CLAUDE.md` — Cloud Run 規約 / 命名規約

### 1. test user seed CLI の作成

`server/src/bin/seed-test-user.ts` を新規作成:

```typescript
#!/usr/bin/env bun
/**
 * E2E test 用に test user + session を DB に挿入する CLI
 * Usage: bun run server/src/bin/seed-test-user.ts <twitch_user_id> [session_id]
 *
 * 出力: { sessionId, csrfToken, userId } を JSON で stdout
 * Playwright が `context.addCookies` で session_id を設定するために使う
 */
import { randomBytes, randomUUID } from "node:crypto";
import { initDatabase } from "../infra/db";
import { createLogger } from "../infra/logger";

async function main() {
  const twitchUserId = process.argv[2] ?? "test-user-123456";
  const sessionId = process.argv[3] ?? randomUUID();
  const csrfToken = randomBytes(32).toString("base64url");

  const logger = createLogger();
  const db = await initDatabase(logger);

  // users upsert
  const userResult = await db.queryGet<{ id: string }>({
    query: `INSERT INTO users (twitch_user_id, login, display_name) VALUES (?, ?, ?)
            ON CONFLICT (twitch_user_id) DO UPDATE SET updated_at = now()
            RETURNING id`,
    params: [twitchUserId, "testuser", "Test User"],
  });
  if (!userResult) throw new Error("user insert failed");

  // session create
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.queryRun({
    query: `INSERT INTO sessions (id, user_id, csrf_token, expires_at)
            VALUES (?, ?, ?, ?)`,
    params: [sessionId, userResult.id, csrfToken, expiresAt],
  });

  console.log(JSON.stringify({ sessionId, csrfToken, userId: userResult.id, expiresAt }));
  await db.close();
}

main();
```

`server/package.json` に script を追加:
```json
"scripts": {
  "seed-test-user": "bun run src/bin/seed-test-user.ts"
}
```

### 2. `e2e/helpers/auth.ts` を新規作成

```typescript
import type { BrowserContext } from "@playwright/test";
import { execSync } from "node:child_process";

export interface TestSession {
  sessionId: string;
  csrfToken: string;
  userId: string;
}

export async function loginAsTestUser(
  context: BrowserContext,
  twitchUserId = "test-user-123456",
): Promise<TestSession> {
  // server CLI を呼び出して test user + session を DB に挿入
  const out = execSync(
    `cd ../server && bun run seed-test-user ${twitchUserId}`,
    { encoding: "utf-8" },
  );
  const session = JSON.parse(out) as TestSession & { expiresAt: string };

  // ブラウザに __Host-sid Cookie を設定
  await context.addCookies([
    {
      name: "__Host-sid",
      value: session.sessionId,
      url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
      httpOnly: true,
      secure: false,  // localhost 開発時は HTTP
      sameSite: "Lax",
      path: "/",
    },
  ]);

  // localStorage に Twitch access_token も仕込む (Twitch API mock が応答するため)
  await context.addInitScript((token: string) => {
    sessionStorage.setItem("twitch-auth", JSON.stringify(token));
  }, "fake-access-token");

  return {
    sessionId: session.sessionId,
    csrfToken: session.csrfToken,
    userId: session.userId,
  };
}
```

### 3. 既存 spec の改修

`e2e/scenarios/` 配下の認証必須テスト全部を改修:

**変更前 (例)**:
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    sessionStorage.setItem("twitch-auth", "fake-token");
  });
  await page.reload();
});
```

**変更後**:
```typescript
test.beforeEach(async ({ context, page }) => {
  await loginAsTestUser(context);
  await page.goto("/");
});
```

各 spec で `loginAsTestUser` を呼ぶよう修正。

### 4. tRPC エンドポイントの mock (Playwright)

E2E は実 backend を使うため、`/api/trpc/auth.me` 等は実際にレスポンスを返す。Twitch API のみ mock:

`e2e/mocks/twitch.ts` の追加 (既存 mock パターンに従う):
```typescript
import type { Page } from "@playwright/test";

export async function mockTwitchAPIs(page: Page) {
  await page.route(/api\.twitch\.tv\/helix\/users/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{
          id: "test-user-123456",
          login: "testuser",
          display_name: "Test User",
        }],
      }),
    });
  });

  await page.route(/api\.twitch\.tv\/helix\/channels/, async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{
            broadcaster_id: "test-user-123456",
            game_id: "509658",
            game_name: "Just Chatting",
            title: "Test Stream",
            tags: [],
            broadcaster_language: "ja",
          }],
        }),
      });
    }
  });

  // search/categories, streams/markers も同様に
}
```

### 5. localStorage cleanup の起動時実行

`client/src/utils/legacyCleanup.ts` を新規作成:

```typescript
import { POST_TEMPLATE_KEY } from "./postTemplate";

const MIGRATED_AT_KEY = "templates_migrated_at";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;  // 30 日

export function cleanupLegacyTemplates() {
  const migratedAt = localStorage.getItem(MIGRATED_AT_KEY);
  if (!migratedAt) return;

  const migratedDate = new Date(migratedAt);
  if (isNaN(migratedDate.getTime())) {
    // 無効な値、削除
    localStorage.removeItem(MIGRATED_AT_KEY);
    return;
  }

  if (Date.now() - migratedDate.getTime() < RETENTION_MS) return;

  // 1 ヶ月経過、cleanup
  localStorage.removeItem("templates");
  localStorage.removeItem(POST_TEMPLATE_KEY);
  localStorage.removeItem(MIGRATED_AT_KEY);
  console.log("[cleanup] Legacy localStorage templates cleaned up");
}
```

`client/src/index.tsx` の起動処理で呼び出す:
```typescript
import { cleanupLegacyTemplates } from "./utils/legacyCleanup";

cleanupLegacyTemplates();

// ... 既存の React render
```

### 6. `cloudrun.yaml` の secret env を完成

PR 1 で雛形を作ったが、本 PR で実値が secret 経由で取れることを確認:

```yaml
- name: TWITCH_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: stream-tag-inventory-twitch-client-id
      key: latest
- name: APP_BASE_URL
  value: https://tags.yuniruyuni.net
```

### 7. `.github/workflows/deploy.yml` の改修

build job で client 側に env を注入:

```yaml
- name: Build production
  env:
    BUN_PUBLIC_TWITCH_CLIENT_ID: ${{ secrets.TWITCH_CLIENT_ID }}
    BUN_PUBLIC_APP_BASE_URL: https://tags.yuniruyuni.net
  run: bun run build
```

`secrets.TWITCH_CLIENT_ID` は GitHub Secrets に予め登録 (本 PR の作業として手動設定の手順を README に書く)。

### 8. `README.md` のセクション追加

#### 「Twitch app 登録」セクション
```markdown
## Twitch app 登録

本アプリは Twitch OIDC で認証する。デプロイ前に Twitch Developer Console で app を登録する必要がある:

1. https://dev.twitch.tv/console にログイン
2. 「Register Your Application」で新規 app を作成
3. **OAuth Redirect URLs** に以下を登録:
   - 本番: `https://tags.yuniruyuni.net/`
   - 開発: `http://localhost:3000/`
4. **Client Type** は **Public** を選択 (Implicit Hybrid Flow を使用、Client Secret 不要)
5. 取得した Client ID を以下に設定:
   - GitHub Secrets: `TWITCH_CLIENT_ID`
   - Google Secret Manager: `gcloud secrets create stream-tag-inventory-twitch-client-id --data-file=- <<< "$CLIENT_ID"`
   - ローカル: `.env.local` の `TWITCH_CLIENT_ID` および `BUN_PUBLIC_TWITCH_CLIENT_ID`
```

#### 「Cloudflare Cache Rule 設定」セクション
```markdown
## Cloudflare Cache Rule 設定

`tags.yuniruyuni.net` のユーザー固有レスポンスが中間 CDN にキャッシュされないよう、Cloudflare ダッシュボードで Cache Rule を設定する:

1. Cloudflare ダッシュボード → `tags.yuniruyuni.net` Zone → Caching → Cache Rules
2. 「Create rule」で以下を設定:
   - **If**: `(http.request.uri.path matches "^/api/")`
   - **Then**: `Cache eligibility: Bypass cache`
3. 保存

設定後の確認:
\`\`\`bash
curl -I https://tags.yuniruyuni.net/api/trpc/auth.me
# Header に cf-cache-status: BYPASS または DYNAMIC が出ていれば OK
\`\`\`
```

#### 「Secret Manager 初期セットアップ」セクション
```markdown
## Secret Manager (Google Cloud) 初期セットアップ

本アプリは以下のシークレットを必要とする:

\`\`\`bash
# Twitch Client ID (本番 app の値)
echo -n "$TWITCH_CLIENT_ID" | gcloud secrets create stream-tag-inventory-twitch-client-id --data-file=-

# 既存: DB password 等は別途
\`\`\`

シークレットの ローテーション:
\`\`\`bash
echo -n "$NEW_CLIENT_ID" | gcloud secrets versions add stream-tag-inventory-twitch-client-id --data-file=-
\`\`\`
```

### 9. `CLAUDE.md` の更新

以下のセクションを追記または更新:

#### 「認証フロー」セクション (新規)
```markdown
## 認証フロー

OIDC Implicit Hybrid Flow (`response_type=token id_token`) を使用:

- client が Twitch から access_token と id_token を同時取得 (URL fragment)
- access_token: client の sessionStorage に保管、Twitch API 直接呼出に使用 (サーバは触れない)
- id_token: サーバへ POST → JWKS で検証 → HttpOnly Cookie で session 発行
- サーバはユーザーの identity (Twitch user id) と Y.Doc の同期状態 (`template_docs` に 1 ユーザー 1 行) のみ管理

詳細は `docs/plans/00-overview.md` を参照。
```

#### 「環境変数」セクション (拡張)
```markdown
## 環境変数

### Server
- `TWITCH_CLIENT_ID`: id_token の `aud` 検証用 (本番は Cloud Run Secret Manager 経由)
- `APP_BASE_URL`: 自身の base URL (本番 `https://tags.yuniruyuni.net`)
- (既存) `PGHOST`, `PGPORT`, `DB_APP_NAME`, `DB_PASSWORD`

### Client (build 時埋込)
- `BUN_PUBLIC_TWITCH_CLIENT_ID`: Twitch OAuth authorize URL 構築用
- `BUN_PUBLIC_APP_BASE_URL`: redirect_uri 構築用

### Cloud Run シークレット命名
新規: `stream-tag-inventory-twitch-client-id`
既存: `stream-tag-inventory-db-password`, `stream-tag-inventory-db-app-password`, `cf-db-access-client-id`, `cf-db-access-client-secret`
```

#### 「Cloudflare Cache 制御」セクション (新規)
```markdown
## Cloudflare Cache 制御

`/api/*` 配下のレスポンスはユーザー固有なので絶対にキャッシュさせない:

- アプリ層: `Cache-Control: no-store, no-cache, must-revalidate, private` を `noStoreMiddleware` で付与 (`server/src/presentation/middleware/no-store.ts`)
- Cloudflare 層: Cache Rule で `/api/*` を Bypass cache に設定 (手動、README 参照)

両者で多層防御。設定漏れの検証は `curl -I https://tags.yuniruyuni.net/api/trpc/auth.me` の `cf-cache-status` ヘッダで行う。
```

#### 「passive theft 対策の推奨運用」セクション (新規)
```markdown
## ドメイン関連の運用推奨事項

ドメイン乗っ取り時の passive theft (sessionStorage の Twitch token 詐取) はアプリ層で完全防御不可能。運用層で以下を推奨:

- DNS provider の MFA を有効化
- 証明書発行の監視 (Certificate Transparency log を watch)
- Cloudflare の Bot Fight Mode 等で異常アクセス検知

詳細な脅威モデルは `docs/plans/00-overview.md` のセキュリティチェックリスト参照。
```

### 10. ドキュメントの最終確認

- [ ] `docs/plans/00-overview.md` から各 PR ドキュメントへのリンクが正しい
- [ ] `README.md` の Quick Start が新フローを反映
- [ ] `CONTRIBUTING.md` / `CONTRIBUTING.en.md` に env 設定手順を追記 (必要なら)

---

## テスト

### E2E
- `bun run check:e2e` 全緑
- 既存 spec が Cookie 認証で動作
- 新フロー (login flow を E2E でカバー) はオプション (Twitch リダイレクトを E2E でテストするのは複雑、本 PR では skip)

### Manual Verification
1. 本番デプロイ手順を nondestructive に確認:
   - `gcloud secrets describe stream-tag-inventory-twitch-client-id` で secret 存在確認
   - GitHub Actions の `deploy.yml` を読み、env 注入が正しく書かれているか確認
2. 本番デプロイ後の確認:
   - `curl -I https://tags.yuniruyuni.net/api/trpc/auth.me` で `Cache-Control: no-store` と `cf-cache-status: BYPASS|DYNAMIC` を確認
   - Twitch ログイン成功
   - Cloud SQL の `users` テーブルに行が挿入される
   - 別端末で同じユーザーがログインしてテンプレートが共有される

---

## Definition of Done

- [ ] `server/src/bin/seed-test-user.ts` 作成、`server/package.json` に script 追加
- [ ] `e2e/helpers/auth.ts` 作成
- [ ] 既存 E2E spec を `loginAsTestUser` ベースに改修
- [ ] `e2e/mocks/twitch.ts` で Twitch API mock 追加
- [ ] `client/src/utils/legacyCleanup.ts` 作成、`client/src/index.tsx` で起動時実行
- [ ] `.github/workflows/deploy.yml` で `BUN_PUBLIC_*` env 注入
- [ ] `README.md` に Twitch app 登録 / Cloudflare Cache Rule / Secret Manager 手順を追加
- [ ] `CLAUDE.md` に認証フロー / 環境変数 / Cloudflare Cache 制御 / 運用推奨事項を追記
- [ ] `bun run check` 全緑
- [ ] `bun run check:e2e` 全緑
- [ ] `bun run build` 成功
- [ ] 本番デプロイ手順の手動確認 (gcloud secrets / GitHub Secrets / Cloudflare Cache Rule の設定)
- [ ] PR description で「シリーズ最終 PR、デプロイ前 review 推奨」を明記

---

## デプロイ前チェックリスト

本 PR をマージ後、本番反映前に以下を順に実行:

1. [ ] `gcloud secrets create stream-tag-inventory-twitch-client-id --data-file=-` で本番 Twitch app の Client ID を登録
2. [ ] GitHub Secrets `TWITCH_CLIENT_ID` を設定 (本番 app の値)
3. [ ] Twitch Developer Console で本番 app の Redirect URL に `https://tags.yuniruyuni.net/` が登録されていること確認
4. [ ] Cloudflare ダッシュボードで `/api/*` の Cache Rule (Bypass) が設定されていること確認
5. [ ] `.github/workflows/deploy.yml` を手動 trigger でデプロイ
6. [ ] migration job が成功 (5 テーブル + インデックス)
7. [ ] service が起動 (`/health` が 200)
8. [ ] `https://tags.yuniruyuni.net` でログイン成功
9. [ ] Cloud SQL の `users` / `sessions` テーブルに行が挿入される
10. [ ] `curl -I https://tags.yuniruyuni.net/api/trpc/auth.me` で `cf-cache-status: BYPASS|DYNAMIC` 確認
11. [ ] 別端末ログインでテンプレート共有確認

---

## 既知の落とし穴

- **`crypto.randomUUID()` の利用**: seed-test-user CLI で `crypto.randomUUID()` を使う際、Node 16+ または Bun では globalThis に存在。古い環境では `node:crypto` から import が必要
- **E2E の Cookie secure フラグ**: localhost (HTTP) では `secure: false`、本番 (HTTPS) では `secure: true`。`E2E_BASE_URL` 環境変数で分岐
- **Twitch API mock の network route**: Playwright の `page.route` は **明示的に呼ばれた page でのみ** 有効。`context.route` でコンテキスト全体に適用するのが安全
- **Cloudflare Cache Rule が IaC 化されていない**: Terraform 化を後続で検討 (本 PR では手動設定 + ドキュメント化のみ)
- **デプロイの順序**: PR 1 のスキーマが本番に反映されるのは本 PR のデプロイで初めて。migration job が実行されるタイミング (`deploy.yml` の `migrate` ステップ) を再確認
- **`cloudrun-job.yaml` (migration job 用) は env 追加不要**: Twitch 認証情報は migration job では使わない。誤って secret 参照を追加しない
- **`__Host-` Cookie の Secure 必須**: 本番 HTTPS で必須。Cloudflare 経由でも HTTPS が strict なら問題なし
- **legacy cleanup の安全性**: `cleanupLegacyTemplates` が誤って削除しないよう、必ず `migrated_at` の存在 + 1 ヶ月経過の両方をチェック。0 件 or 無効な日付なら何もしない
- **client build の env 埋込み確認**: deploy 後の `static/index.js` に `TWITCH_CLIENT_ID` 値が文字列として含まれているか必ず確認 (`grep` で)
- **passive theft の運用層対策はドキュメントのみ**: HSTS preload / CAA / DNSSEC は本 PR の実装範囲外、推奨事項として CLAUDE.md に記載するに留める
