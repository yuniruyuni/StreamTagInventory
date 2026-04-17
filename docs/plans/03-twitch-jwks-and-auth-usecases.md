# PR 3: Twitch JWKS + id_token 検証 + auth ユースケース

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」第 3 弾。共通設計・セキュリティモデルは [`00-overview.md`](./00-overview.md) を参照。

### 前提
- PR 1 で DB schema が整備済
- PR 2 で `users` / `sessions` / `oidcNonce` Repository が利用可能
- 環境変数 `TWITCH_CLIENT_ID` が `process.env` から読める状態 (PR 1 で docker-compose.yml に追加済)

### この PR の目的
- Twitch の **JWKS** (公開鍵) を取得・キャッシュする infra 実装
- Twitch から受け取った **id_token (JWT)** を暗号学的に検証する関数
- それを使う **auth ユースケース 4 つ** (`startNonce`, `login`, `logout`, `me`) の実装

### 設計の根拠
- **`jose` ライブラリを使う理由**: JWKS の自動取得・キャッシュ、RS256 検証、claim 検証 (iss/aud/exp/nonce) を高品質に提供。`jsonwebtoken` 等は JWKS 取得を別途書く必要があり手間
- **JWKS のキャッシュ TTL 1 時間**: Twitch 側の鍵ローテに対応しつつ、毎リクエストでの JWKS fetch を回避
- **nonce の atomic consume** (PR 2 で実装済の `oidcNonces.consume`): id_token 検証成功後、nonce を 1 度限り使えるよう保証
- **Usecase Runner の使い方**: `auth.login` は read (nonce / user 検索) → process (id_token 検証) → write (users upsert + sessions INSERT) の順で構成。詳細は `server/src/usecases/runner.ts` 参照

### 後続 PR との関係
- PR 4 (middleware + tRPC) が `auth.startNonce` / `auth.login` / `auth.me` / `auth.logout` をルーターに公開
- PR 6 (frontend) が同じユースケースを tRPC client から叩く

---

## タスク

### 0. 既存パターンの確認

実装前に以下を読むこと:
- `server/src/usecases/runner.ts` — usecase pattern の 7 phase
- `server/src/usecases/context.ts` — Context 型
- `server/src/models/common/{result,fail,id}.ts` — Result, Fail, generateId
- 02-repository-layer.md の Repository インターフェース

### 1. `jose` ライブラリの追加

```bash
cd server && bun add jose
```

`server/package.json` の `dependencies` に `jose` (^5.x) が追加されることを確認。`bun.lock` も更新される。

### 2. `server/src/infra/twitch/types.ts` を新規作成

```typescript
// id_token の検証済み payload (verified claims)
export interface IdTokenClaims {
  sub: string;                    // Twitch user id (string)
  iss: string;                    // "https://id.twitch.tv/oauth2"
  aud: string;                    // TWITCH_CLIENT_ID
  exp: number;                    // Unix epoch seconds
  iat: number;
  nonce?: string;
  preferred_username?: string;    // Twitch username (login)
  picture?: string;               // 将来用 (profile image)
}
```

### 3. `server/src/infra/twitch/jwks.ts` を新規作成

```typescript
import { createRemoteJWKSet } from "jose";

const JWKS_URL = new URL("https://id.twitch.tv/oauth2/keys");

// jose の createRemoteJWKSet は内部で 10 分間のキャッシュを持つ (jose v5 デフォルト)
// より長くしたい場合は cacheMaxAge を指定 (ms 単位)
export const twitchJwks = createRemoteJWKSet(JWKS_URL, {
  cacheMaxAge: 60 * 60 * 1000,  // 1 時間
});
```

**メモ**:
- module scope の singleton でメモリキャッシュ
- テストでは `vi.mock` 相当の bun mock で差し替え可能 (jose のモック方法は要調査)

### 4. `server/src/infra/twitch/verify-id-token.ts` を新規作成

```typescript
import { jwtVerify } from "jose";
import { fail, type Fail } from "../../models/common/fail";
import type { Result } from "../../models/common/result";
import { twitchJwks } from "./jwks";
import type { IdTokenClaims } from "./types";

export interface VerifyOptions {
  expectedAudience: string;       // TWITCH_CLIENT_ID
  expectedNonce: string;          // サーバが発行した nonce
}

export async function verifyIdToken(
  idToken: string,
  options: VerifyOptions,
): Promise<Result<IdTokenClaims, Fail>> {
  try {
    const { payload } = await jwtVerify(idToken, twitchJwks, {
      issuer: "https://id.twitch.tv/oauth2",
      audience: options.expectedAudience,
    });

    if (typeof payload.sub !== "string") {
      return { ok: false, error: fail("INVALID_INPUT", "id_token missing sub") };
    }

    if (payload.nonce !== options.expectedNonce) {
      return { ok: false, error: fail("INVALID_INPUT", "id_token nonce mismatch") };
    }

    return {
      ok: true,
      value: {
        sub: payload.sub,
        iss: payload.iss as string,
        aud: payload.aud as string,
        exp: payload.exp as number,
        iat: payload.iat as number,
        nonce: payload.nonce as string,
        preferred_username:
          typeof payload.preferred_username === "string"
            ? payload.preferred_username
            : undefined,
        picture:
          typeof payload.picture === "string" ? payload.picture : undefined,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: fail("INVALID_INPUT", "id_token verification failed", {
        cause: String(e),
      }),
    };
  }
}
```

**メモ**:
- `jwtVerify` が iss / aud / exp / 署名 を全部検証してくれる
- nonce は手動チェック (jose は知らないため)
- 失敗時の details に `cause` (エラーメッセージ) を入れる。**但し本番ログで token そのものは絶対に出さない**

### 5. `server/src/infra/twitch/verify-id-token.test.ts` を新規作成

bun:test で以下のケースをカバー:

```typescript
import { describe, expect, test, mock } from "bun:test";
import { SignJWT, generateKeyPair, exportJWK } from "jose";

// jose の createRemoteJWKSet を mock してテスト用 keypair を返すように差し替え

describe("verifyIdToken", () => {
  test("正規 id_token で payload を返す", async () => { /* ... */ });
  test("署名改ざんで fail", async () => { /* ... */ });
  test("期限切れで fail", async () => { /* ... */ });
  test("iss 不一致で fail", async () => { /* ... */ });
  test("aud 不一致で fail", async () => { /* ... */ });
  test("nonce 不一致で fail", async () => { /* ... */ });
  test("sub が無い id_token で fail", async () => { /* ... */ });
});
```

実装ヒント:
- `jose` の `generateKeyPair("RS256")` でテスト用鍵ペア生成
- `SignJWT` で id_token 模擬を作成
- `twitchJwks` を mock してテスト鍵で検証する
- `mock.module("./jwks", ...)` で差し替え (Bun の mock API 確認)

### 6. `server/src/usecases/auth/startNonce.ts` を新規作成

```typescript
import { randomBytes } from "node:crypto";
import { OidcNonce } from "../../models/oidcNonce";
import { usecase } from "../runner";

export interface StartNonceResult {
  nonce: string;
}

export const startNonceUsecase = usecase({
  pre: (ctx) => {
    const nonce = randomBytes(32).toString("base64url");
    const expiresAt = new Date(ctx.now.getTime() + 10 * 60 * 1000);
    return OidcNonce.create({ nonce, expiresAt, now: ctx.now });
  },
  write: async (ctx, model) => {
    await ctx.repos.oidcNonce.upsert(model);
    return model;
  },
  result: (model): StartNonceResult => ({ nonce: model.nonce }),
});
```

**メモ**:
- Model factory `OidcNonce.create(...)` で entity を組み立て、`upsert` で永続化 (標準メソッド使用)
- `ctx.now` を使うことで test 時に時刻固定可能 (usecase runner が呼出時点の Date を凍結)

### 7. `server/src/usecases/auth/login.ts` を新規作成

最も複雑な usecase。責務:
1. id_token を受け取る (input)
2. **nonce を atomic consume** (`oidcNonce.delete(ByValue(n).and(ActiveAt(now)))` の影響行数で判定)
3. id_token を `verifyIdToken` で検証 (process)
4. user を取得 or 新規作成、session を新規作成 (write)
5. 結果として `{ sessionId, csrfToken, user, expiresAt }` を返す

```typescript
import { randomBytes } from "node:crypto";
import { fail, and } from "../../models/common";
import { OidcNonce } from "../../models/oidcNonce";
import { Session } from "../../models/session";
import { User } from "../../models/user";
import { verifyIdToken } from "../../infra/twitch/verify-id-token";
import { usecase } from "../runner";

export interface LoginInput {
  idToken: string;
  expectedNonce: string;
}

export interface LoginResult {
  sessionId: string;
  csrfToken: string;
  user: { id: string; twitchUserId: string; login: string; displayName: string };
  expiresAt: Date;
}

export function createLoginUsecase(input: LoginInput) {
  return usecase({
    pre: (ctx) => {
      if (!input.idToken) return fail("INVALID_INPUT", "idToken is required");
      if (!input.expectedNonce) return fail("INVALID_INPUT", "nonce is required");
      return { now: ctx.now };
    },
    write: async (ctx, state) => {
      // 1. nonce を atomic に consume
      // delete(ByValue(n) AND ActiveAt(now)) で影響行数 > 0 なら有効、0 なら無効/期限切れ
      const consumedRows = await ctx.repos.oidcNonce.delete(
        and(OidcNonce.ByValue(input.expectedNonce), OidcNonce.ActiveAt(state.now)),
      );
      if (consumedRows === 0) {
        return fail("INVALID_INPUT", "nonce already used or expired");
      }

      // 2. id_token 検証 (atomic consume の後に行う = 失敗してもリプレイ不可)
      const verifyResult = await verifyIdToken(input.idToken, {
        expectedAudience: process.env.TWITCH_CLIENT_ID ?? "",
        expectedNonce: input.expectedNonce,
      });
      if (!verifyResult.ok) return verifyResult.error;
      const claims = verifyResult.value;

      // 3. user を get → なければ create、あれば last_login_at 等を更新して upsert
      const existing = await ctx.repos.user.get(User.ByTwitchUserId(claims.sub));
      const user: User = existing
        ? { ...existing, login: claims.preferred_username ?? existing.login,
            displayName: claims.preferred_username ?? existing.displayName,
            updatedAt: state.now, lastLoginAt: state.now }
        : User.create({
            twitchUserId: claims.sub,
            login: claims.preferred_username ?? "",
            displayName: claims.preferred_username ?? "",
            now: state.now,
          });
      await ctx.repos.user.upsert(user);

      // 4. session 作成
      const csrfToken = randomBytes(32).toString("base64url");
      const expiresAt = new Date(state.now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const session = Session.create({
        userId: user.id,
        csrfToken,
        expiresAt,
        now: state.now,
      });
      await ctx.repos.session.upsert(session);

      return { user, session };
    },
    result: ({ user, session }): LoginResult => ({
      sessionId: session.id,
      csrfToken: session.csrfToken,
      user: { id: user.id, twitchUserId: user.twitchUserId, login: user.login, displayName: user.displayName },
      expiresAt: session.expiresAt,
    }),
  });
}
```

**重要**:
- nonce の atomic consume は **`delete(ByValue(n).and(ActiveAt(now)))` の影響行数判定** で実現。`consume` という非標準メソッドは作らない (規約遵守)
- consume 成功 (rowCount > 0) してから id_token 検証 → 失敗してもリプレイ不可
- user は `get` → 既存なら entity を再構築して `upsert`、無ければ `create` factory で生成して `upsert`。すべて標準メソッドのみ
- session は `Session.create` factory で `id` / `createdAt` / `lastSeenAt` を自動設定し `upsert`
- `process.env.TWITCH_CLIENT_ID` は起動時必須チェック (本 PR 内で対応)

### 8. `server/src/usecases/auth/logout.ts` を新規作成

```typescript
import { Session } from "../../models/session";
import { usecase } from "../runner";

export interface LogoutInput {
  sessionId: string;
}

export const createLogoutUsecase = (input: LogoutInput) =>
  usecase({
    write: async (ctx) => {
      await ctx.repos.session.delete(Session.ById(input.sessionId));
      return {};
    },
    result: () => ({ ok: true as const }),
  });
```

**メモ**:
- 標準メソッド `delete(spec)` を使用、spec は `Session.ById(...)`
- Twitch の access_token は revoke しない (Implicit Hybrid では別端末で同じユーザーが利用中の可能性。サーバ側 session 削除のみ)

### 9. `server/src/usecases/auth/me.ts` を新規作成

```typescript
export interface MeResult {
  user: {
    id: string;
    twitchUserId: string;
    login: string;
    displayName: string;
  };
  csrfToken: string;
}

export const meUsecase = usecase({
  // ctx.user / ctx.session は middleware が前段でセット (PR 4 で対応)
  // 本 usecase は protectedProcedure で呼ばれる前提なので user/session 必須
  result: (state) => {
    // ここでは ctx を直接参照できないので、result に渡される state に持っているか確認
  },
});
```

**注意**: `me` usecase は ctx に既にセットされた `user` / `session` を返すだけ。`Context` の `session?` / `user?` は PR 4 で追加するが、PR 3 段階ではまだ存在しない可能性。

→ **本 PR では `me` の usecase 実装を後回しにし、PR 4 で `Context` 拡張と同時に実装する** ことを推奨。本 PR では skeleton のみ作成 (compile が通る程度)。

### 10. `server/src/usecases/auth/login.test.ts` を新規作成

ケース:
- nonce が consume 済で fail
- id_token 検証失敗で fail
- 正常系で users upsert + session create が両方走る
- users upsert が冪等 (同じ twitch_user_id で 2 回 login しても 1 行)

### 11. `server/src/index.ts` の起動時 env チェック追加

```typescript
async function bootstrap() {
  if (!process.env.TWITCH_CLIENT_ID) {
    throw new Error("TWITCH_CLIENT_ID environment variable is required");
  }
  // ... 既存の logger / db / context / app 初期化
}
```

---

## テスト

### Unit Test
- `server/src/infra/twitch/verify-id-token.test.ts`: 7 ケース (正規 / 改ざん / 期限切れ / iss / aud / nonce / sub欠如)
- `server/src/usecases/auth/login.test.ts`: 4 ケース以上 (nonce失敗 / id_token失敗 / 正常系 / 冪等性)
- `server/src/usecases/auth/startNonce.test.ts`: nonce が DB に保存される、`expires_at` が ~10 分後

### 実行
```bash
bun run check:test
```

---

## Definition of Done

- [ ] `server/package.json` に `jose` 追加、`bun.lock` 更新
- [ ] `server/src/infra/twitch/types.ts` 作成
- [ ] `server/src/infra/twitch/jwks.ts` 作成
- [ ] `server/src/infra/twitch/verify-id-token.ts` 作成
- [ ] `server/src/infra/twitch/verify-id-token.test.ts` 作成 (7 ケース全部緑)
- [ ] `server/src/usecases/auth/startNonce.ts` 作成
- [ ] `server/src/usecases/auth/login.ts` 作成
- [ ] `server/src/usecases/auth/logout.ts` 作成
- [ ] `server/src/usecases/auth/me.ts` skeleton 作成 (PR 4 で完成)
- [ ] `server/src/usecases/auth/login.test.ts` 作成 (主要ケース)
- [ ] `server/src/index.ts` で `TWITCH_CLIENT_ID` 起動時必須チェック
- [ ] `bun run check` 全緑
- [ ] `bun run build` 成功

---

## 既知の落とし穴

- **`jose` の version**: v5 系を採用。v4 と API が一部異なるので注意
- **JWKS の URL ハードコード**: `https://id.twitch.tv/oauth2/keys` を `infra/twitch/jwks.ts` のみに置く。複数箇所に書かない
- **nonce consume のタイミング**: 必ず id_token 検証より **先** に consume する。検証失敗でも nonce は使い切る (再利用防止)
- **token をログに出さない**: `verifyIdToken` の失敗時の details に `idToken` 自体を入れないこと。`cause` は内部エラーメッセージのみ
- **`crypto.randomUUID()` vs `generateId()`**: 既存コードは `models/common/id.ts` の `generateId()` を使う規約。session.id / nonce にも `generateId()` を使うか、`crypto.randomUUID()` 直書きは統一性のため `generateId()` 経由を推奨
- **`process.env.TWITCH_CLIENT_ID` の参照箇所**: `verifyIdToken` 内で読むと test が困難。引数として渡すパターンが望ましい (上記サンプルは引数渡し)
- **nonce 文字列の長さ**: base64url(32B) = 約 43 文字。DB の `TEXT` カラムに収まる
- **session expires_at と Cookie Max-Age の整合**: usecase で `expiresAt` を返し、middleware (PR 4) で Cookie 発行時に同じ値を使う
