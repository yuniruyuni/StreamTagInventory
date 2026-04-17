# PR 4: tRPC 拡張 + middleware + auth ルーター

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」第 4 弾。共通設計・セキュリティモデルは [`00-overview.md`](./00-overview.md) を参照。

### 前提
- PR 1 で DB schema 整備
- PR 2 で `users` / `sessions` / `oidcNonce` Repository 利用可能
- PR 3 で `verifyIdToken`, `startNonceUsecase`, `createLoginUsecase`, `createLogoutUsecase` 利用可能 (auth.me は skeleton のみ)

### この PR の目的
- Hono middleware を 3 つ追加: **session 復元**, **CSRF 検証**, **`Cache-Control: no-store`**
- tRPC の `Context` を拡張し `protectedProcedure` を追加
- `auth.startNonce` / `auth.login` / `auth.logout` / `auth.me` の 4 メソッドを tRPC ルーターに公開
- `auth.me` ユースケースを完成 (PR 3 の skeleton を埋める)

### 設計の根拠
- **session 復元 middleware**: Cookie から `__Host-sid` を読み、DB lookup → `c.set('user', ...)` / `c.set('session', ...)`
- **CSRF middleware**: tRPC の mutation メソッド (POST) で `x-csrf-token` ヘッダーを検証。`crypto.timingSafeEqual` で比較
- **no-store middleware**: `/api/*` の全レスポンスに `Cache-Control: no-store, ...` を強制 (Cloudflare キャッシュ汚染防止、00-overview.md 参照)
- **`__Host-` prefix**: Cookie のセキュリティ強化。Domain 指定不可、Path=/、Secure 必須
- **`SameSite=Lax`**: CSRF の第 1 線防御
- **csrfToken は Cookie に出さない** (XSS 耐性向上)、レスポンス body で渡し client memory に保持

### 後続 PR との関係
- PR 5 (テンプレートルーター) が `protectedProcedure` を使う
- PR 6 (frontend) が `auth.startNonce` / `auth.login` / `auth.me` / `auth.logout` を tRPC client から叩く

---

## タスク

### 0. 既存コードの確認

実装前に以下を読むこと:
- `server/src/presentation/index.ts` — 既存の `createApp(ctx)` 実装、middleware 配線
- `server/src/presentation/trpc/init.ts` — tRPC 初期化、`router` / `publicProcedure` のエクスポート
- `server/src/presentation/trpc/routers/index.ts` — 現状 `appRouter = router({})` の空状態
- `server/src/presentation/trpc/handle-result.ts` — `Result<T,Fail>` → `TRPCError` 変換
- `server/src/usecases/context.ts` — Context 型 (現状は `session` / `user` 無し)
- Hono の Cookie API: `getCookie(c, name)`, `setCookie(c, name, value, options)`, `deleteCookie(c, name)` (`hono/cookie` から import)
- @trpc/server の `createMiddleware` および `procedure.use(...)` の使い方

### 1. `server/src/usecases/context.ts` を拡張

```typescript
import type { Database } from "../infra/db/database";
import type { ILogger } from "../infra/logger/types";
import type { FullRepos, Repos } from "../repositories";

export interface SessionContext {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: Date;
}

export interface UserContext {
  id: string;
  twitchUserId: string;
  login: string;
  displayName: string;
}

export interface Context {
  now: Date;
  logger: ILogger;
  db: Database;
  rawRepos: Repos;
  repos: FullRepos<Repos>;
  session?: SessionContext;
  user?: UserContext;
}

// 既存の PreContext / ReadContext / ProcessContext / WriteContext / PostContext / FinishContext にも
// session?: SessionContext; user?: UserContext; を追加
```

**注意**:
- `session` / `user` は optional。middleware で復元失敗時 (= 未ログイン) は undefined のまま
- 既存の Phase Context 群 (PreContext 等) も同様に `session?` / `user?` を追加するかは要判断。本案では追加しない (usecase 内で ctx.user を直接見ない、必要なら usecase の input に渡す方針)

### 2. `server/src/presentation/middleware/session.ts` を新規作成

```typescript
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { and } from "../../models/common";
import { Session } from "../../models/session";
import { User } from "../../models/user";
import type { Context as AppContext } from "../../usecases/context";

export const SESSION_COOKIE_NAME = "__Host-sid";

export interface SessionMiddlewareDeps {
  ctx: AppContext;
}

export const createSessionMiddleware = (deps: SessionMiddlewareDeps) =>
  createMiddleware(async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (!sessionId) return next();

    const now = new Date();
    // 有効な session のみ取得 (期限切れは null)
    const session = await deps.ctx.repos.session.get(
      and(Session.ById(sessionId), Session.ActiveAt(now)),
    );
    if (!session) return next();

    const user = await deps.ctx.repos.user.get(User.ById(session.userId));
    if (!user) {
      // user 不在 (削除済) — session も標準 delete で物理削除
      await deps.ctx.repos.session.delete(Session.ById(session.id));
      return next();
    }

    // last_seen_at touch: 標準 upsert で同じ entity を再保存 (lastSeenAt のみ更新)
    // 失敗しても無視 (best effort)
    deps.ctx.repos.session
      .upsert({ ...session, lastSeenAt: now })
      .catch(() => {});

    c.set("session", {
      id: session.id,
      userId: session.userId,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    });
    c.set("user", {
      id: user.id,
      twitchUserId: user.twitchUserId,
      login: user.login,
      displayName: user.displayName,
    });

    return next();
  });
```

**注意**:
- 標準メソッドのみ使用: `session.get(spec)` / `user.get(spec)` / `session.upsert(model)` / `session.delete(spec)`
- 期限切れ判定は `Session.ActiveAt(now)` spec を AND 合成して `get` に渡す。Repository に `findActiveById` のような特化メソッドは作らない
- `touch` の代わりに `upsert(session entity with new lastSeenAt)`。Repository は標準メソッドのみ
- `c.set("session", ...)` の型定義のため、Hono の `Variables` 型を declare する必要あり

### 3. `server/src/presentation/middleware/csrf.ts` を新規作成

```typescript
import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "node:crypto";

export const csrfMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method.toUpperCase();
  // GET, HEAD, OPTIONS は skip (副作用なし)
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const session = c.get("session");
  if (!session) {
    return next();  // 未ログインは別の middleware (protectedProcedure) で 401
  }

  const headerToken = c.req.header("x-csrf-token");
  if (!headerToken) {
    return c.json({ error: "csrf_token missing" }, 403);
  }

  const a = Buffer.from(session.csrfToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return c.json({ error: "csrf_token mismatch" }, 403);
  }

  return next();
});
```

**注意**:
- tRPC の HTTP メソッド: query は GET (バッチは GET)、mutation は POST。tRPC v11 の確認要
- 一部の middleware は tRPC mutation の前段に挟む必要あり、配線順序が重要

### 4. `server/src/presentation/middleware/no-store.ts` を新規作成

```typescript
import { createMiddleware } from "hono/factory";

export const noStoreMiddleware = createMiddleware(async (c, next) => {
  await next();
  c.res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private, max-age=0",
  );
  c.res.headers.set("Pragma", "no-cache");
  c.res.headers.set("Vary", "Cookie, Authorization");
});
```

### 5. `server/src/presentation/middleware/no-store.test.ts` を新規作成

bun:test で `/api/*` 配下のレスポンスに `Cache-Control: no-store` が付与されることを確認。

### 6. `server/src/presentation/trpc/init.ts` を拡張

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "../../usecases/context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  });
});
```

`protectedProcedure` を使うと `ctx.user` / `ctx.session` が non-nullable に narrow される。

### 7. `server/src/usecases/auth/me.ts` を完成

```typescript
import type { UserContext, SessionContext } from "../context";

export interface MeResult {
  user: UserContext;
  csrfToken: string;
}

// usecase pattern を使わず、ctx の値をそのまま返す軽量関数
export function meHandler(user: UserContext, session: SessionContext): MeResult {
  return {
    user,
    csrfToken: session.csrfToken,
  };
}
```

**メモ**:
- `me` は I/O が無いため runner を使う必要なし
- protectedProcedure の `ctx.user` / `ctx.session` を直接返す

### 8. `server/src/presentation/trpc/routers/auth.ts` を新規作成

```typescript
import { z } from "zod";
import { setCookie, deleteCookie } from "hono/cookie";
import { router, publicProcedure, protectedProcedure } from "../init";
import { handleResult } from "../handle-result";
import { startNonceUsecase } from "../../../usecases/auth/startNonce";
import { createLoginUsecase } from "../../../usecases/auth/login";
import { createLogoutUsecase } from "../../../usecases/auth/logout";
import { meHandler } from "../../../usecases/auth/me";
import { SESSION_COOKIE_NAME } from "../../middleware/session";

export const authRouter = router({
  startNonce: publicProcedure
    .mutation(async ({ ctx }) => {
      const result = await startNonceUsecase.run(ctx);
      return handleResult(result);
    }),

  login: publicProcedure
    .input(
      z.object({
        idToken: z.string().min(1),
        nonce: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const usecase = createLoginUsecase({
        idToken: input.idToken,
        expectedNonce: input.nonce,
      });
      const result = await usecase.run(ctx);
      const value = handleResult(result);

      // Cookie 発行: tRPC の context から Hono の res にアクセスする方法を確認
      // @hono/trpc-server を使っている場合、ctx.honoContext などが渡される設計が必要
      // → ctx に honoContext を持たせる設計が必要 (下記注意参照)
      // 仮に c が取れるとして:
      // setCookie(c, SESSION_COOKIE_NAME, value.sessionId, {
      //   httpOnly: true,
      //   secure: true,
      //   sameSite: "Lax",
      //   path: "/",
      //   maxAge: Math.floor((value.expiresAt.getTime() - Date.now()) / 1000),
      // });

      return {
        user: value.user,
        csrfToken: value.csrfToken,
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const usecase = createLogoutUsecase({ sessionId: ctx.session.id });
    const result = await usecase.run(ctx);
    handleResult(result);
    // deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true as const };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return meHandler(ctx.user, ctx.session);
  }),
});
```

### 9. tRPC から Hono の Response にアクセスする方法を確立

**重要な設計決定**: tRPC ルーター内で Cookie を発行・削除するために、Hono の `c` (Context) にアクセスする必要がある。

選択肢:
- **A**: tRPC の `createContext` で `c.set("setCookie", fn)` のようなヘルパーを `Context` に持たせ、ルーター内で `ctx.setCookie(...)` を呼ぶ
- **B**: `@hono/trpc-server` の `createContext` callback で `honoContext` をそのまま渡し、ルーター内で `ctx.honoContext.res.headers.set(...)` を直接操作
- **C**: tRPC の `responseMeta` で Set-Cookie を返す (tRPC v11 で対応)

**推奨は A**:
- `Context` に optional な `cookieJar?: { set: (name, value, options) => void; delete: (name, options) => void }` を持たせる
- Hono middleware が `c.set("session", ...)` の隣で `c.set("cookieJar", { set: (n, v, o) => setCookie(c, n, v, o), delete: (n, o) => deleteCookie(c, n, o) })` を仕込む
- tRPC `createContext` で Hono context から取り出して Context に詰める
- ルーターで `ctx.cookieJar?.set(...)` を呼ぶ

これを `server/src/presentation/trpc/init.ts` または `presentation/index.ts` の `createContext` callback で実装する。

### 10. `server/src/presentation/trpc/routers/index.ts` を更新

```typescript
import { router } from "../init";
import { authRouter } from "./auth";

export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
```

### 11. `server/src/presentation/index.ts` を改修

```typescript
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { serveStatic } from "hono/bun";
import type { Context as AppContext } from "../usecases/context";
import { createSessionMiddleware } from "./middleware/session";
import { csrfMiddleware } from "./middleware/csrf";
import { noStoreMiddleware } from "./middleware/no-store";
import { appRouter } from "./trpc/routers";

const STATIC_DIR = process.env.STATIC_DIR ?? "../client/static";

declare module "hono" {
  interface ContextVariableMap {
    session?: SessionContext;
    user?: UserContext;
    cookieJar?: { /* ... */ };
  }
}

export function createApp(ctx: AppContext) {
  const app = new Hono();

  app.use(compress());
  app.use(secureHeaders({
    // 既存設定維持。connectSrc は ['self', 'https://api.twitch.tv'] のまま (client が直接 Twitch 呼ぶ)
    contentSecurityPolicy: { /* ... 既存と同じ ... */ },
  }));

  app.get("/health", (c) => c.json({ status: "ok" }));

  // /api/* に no-store を強制 (Cloudflare キャッシュ汚染防止)
  app.use("/api/*", noStoreMiddleware);

  // session 復元 middleware
  const sessionMiddleware = createSessionMiddleware({ ctx });
  app.use("/api/*", sessionMiddleware);

  // cookieJar セット用 middleware
  app.use("/api/*", async (c, next) => {
    c.set("cookieJar", {
      set: (name, value, options) => setCookie(c, name, value, options),
      delete: (name, options) => deleteCookie(c, name, options),
    });
    await next();
  });

  // CSRF middleware (mutation のみ検証)
  app.use("/api/*", csrfMiddleware);

  // tRPC server
  app.use("/api/trpc/*", trpcServer({
    router: appRouter,
    createContext: (_opts, c) => {
      // c は Hono context
      return {
        ...ctx,
        session: c.get("session"),
        user: c.get("user"),
        cookieJar: c.get("cookieJar"),
      };
    },
  }));

  // 既存の Cache-Control middleware は /api/* 以外に限定
  app.use("/*", async (c, next) => {
    await next();
    if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/auth/")) return;
    if (c.res.status < 400) {
      c.res.headers.set("Cache-Control", "public, max-age=0, stale-while-revalidate=86400");
    }
  });

  app.use("/*", serveStatic({ root: STATIC_DIR }));
  app.get("*", serveStatic({ root: STATIC_DIR, path: "index.html" }));

  return app;
}
```

### 12. `server/src/presentation/trpc/handle-result.ts` を更新

`FAIL_CODE_MAP` に `UNAUTHORIZED` と `FORBIDDEN` を追加:

```typescript
const FAIL_CODE_MAP: Record<string, TRPCError["code"]> = {
  NOT_FOUND: "NOT_FOUND",
  INVALID_INPUT: "BAD_REQUEST",
  DUPLICATE: "CONFLICT",
  INTERNAL: "INTERNAL_SERVER_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",   // 追加
  FORBIDDEN: "FORBIDDEN",         // 追加
};
```

---

## テスト

### Unit Test
- `server/src/presentation/middleware/csrf.test.ts`: GET/HEAD/OPTIONS は skip、POST で header 不一致なら 403
- `server/src/presentation/middleware/no-store.test.ts`: `/api/*` レスポンスに `Cache-Control: no-store` が付与される
- `server/src/presentation/middleware/session.test.ts`: Cookie あり/無し、有効/無効 session の挙動
- `server/src/presentation/trpc/routers/auth.test.ts` (任意): 各 endpoint の入出力

### Manual Verification
ローカル開発サーバを起動し:
```bash
# 1. nonce 取得
curl -X POST http://localhost:3000/api/trpc/auth.startNonce -d '{}'
# → { result: { data: { nonce: "..." } } }

# 2. (id_token を持っていないので login は test 用 fixture が必要、後続 PR で対応)

# 3. UNAUTHORIZED 確認
curl http://localhost:3000/api/trpc/auth.me
# → { error: { code: "UNAUTHORIZED" } }

# 4. no-store 確認
curl -I http://localhost:3000/api/trpc/auth.me
# → Cache-Control: no-store, no-cache, ...
```

---

## Definition of Done

- [ ] `server/src/usecases/context.ts` に `session?` / `user?` 追加
- [ ] `server/src/presentation/middleware/{session,csrf,no-store}.ts` 作成
- [ ] middleware の test 追加 (csrf, no-store 必須、session は推奨)
- [ ] `server/src/presentation/trpc/init.ts` に `protectedProcedure` 追加
- [ ] `server/src/usecases/auth/me.ts` 完成 (`meHandler`)
- [ ] `server/src/presentation/trpc/routers/auth.ts` 作成 (4 endpoint)
- [ ] `server/src/presentation/trpc/routers/index.ts` で `auth` ルーター統合
- [ ] `server/src/presentation/trpc/handle-result.ts` に `UNAUTHORIZED` / `FORBIDDEN` マップ追加
- [ ] `server/src/presentation/index.ts` に middleware 配線、CSP は既存維持
- [ ] tRPC ルーターから Cookie 発行できる仕組み (`cookieJar`) を確立
- [ ] `bun run check` 全緑
- [ ] `bun run build` 成功
- [ ] 手動確認: `auth.startNonce` で nonce が返る、`auth.me` で UNAUTHORIZED が返る、`Cache-Control: no-store` が付与される

---

## 既知の落とし穴

- **tRPC から Cookie 設定する設計**: tRPC は HTTP 抽象化を持たないため、`@hono/trpc-server` の `createContext` callback で Hono context を context に注入する必要がある。`cookieJar` 抽象化を作るのが綺麗
- **Hono の `c.set` 型**: `declare module "hono" { interface ContextVariableMap { ... } }` で型を拡張する必要あり (TypeScript の module augmentation)
- **CSP の `connectSrc`**: `'self'` + `'https://api.twitch.tv'` を維持。client が引き続き Twitch 直接通信するため
- **CSRF middleware の配置**: `/api/*` 全体ではなく、`auth.startNonce` / `auth.login` (= 未ログイン時の mutation) は session が無いので skip される必要あり。実装の `if (!session) return next()` で対応済
- **tRPC mutation の HTTP method**: tRPC v11 はバッチ link で複数を 1 リクエストにまとめる。CSRF middleware が複数 mutation 含むリクエストでも 1 度だけ検証で OK
- **`csrfToken` を Cookie に出さない**: 漏洩経路を最小化するため、レスポンス body のみで返す
- **`__Host-` prefix の制約**: `Domain` 属性を付けてはならない、`Path=/`、`Secure` 必須。`Secure` のため localhost で動かない問題に注意 (HTTPS 必須)。開発用に `__Host-` を一時的に外す or `secure: false` 設定するか要検討。**最善は localhost でも HTTPS 化** (`mkcert` 等)、暫定として `secure: process.env.NODE_ENV === "production"` で switching
- **session middleware の touch 失敗**: best effort で握り潰す。touch は重要度低
- **`@hono/trpc-server` の version**: 既存の `^0.4.2` で `createContext` が Hono context を渡す API を確認すること
