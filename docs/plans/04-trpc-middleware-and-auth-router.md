# PR 4: tRPC 拡張 + middleware + auth ルーター

> **Updated 2026-04-19**: 本プランは当初 HttpOnly Cookie + CSRF double-submit で書かれていたが、[ADR 0006](../adr/0006-session-token-via-bearer-header.md) により session token は `Authorization: Bearer` ヘッダで運ぶ設計に変更された。以下の記述のうち「CSRF middleware」「`__Host-sid` Cookie」「cookieJar 抽象」「`csrf_token` 列 / `Session.csrfToken` field」は **全て不要** になっている。code 側が authoritative。本 plan は歴史資料として残置。

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」第 4 弾。共通設計・セキュリティモデルは [`00-overview.md`](./00-overview.md) を参照。

### 前提 (着手時点で済んでいるもの)
- PR 1 で DB schema 整備
- PR 2 で `users` / `sessions` / `oidcNonce` Repository 利用可能
- PR 3 で `verifyIdToken`, `startNonce`, `login`, `logout`, `me` (skeleton) 利用可能
- **PR 78** (既 merge) で `handle-result.ts` に `UNAUTHORIZED` / `FORBIDDEN` マップ追加済 — **本 PR ではこの更新は不要**
- **ADR 0005** (cookie = raw / DB = `sha256` 分離) が採用済。本 PR で実装

### PR 3 landed 済の前提確認

以下は既に実装済なので本 PR の作業対象から除外:

- `Token` class (`server/src/models/common/token.ts`) — base64url 内部表現、`toBase64url()` / `fromBase64url()` / `equals()`
- `OidcNonce.nonce: Token` / `Session.csrfToken: Token`
- usecase は static const 形式: `export const login = usecase({...})` で `login.run(ctx, input)` で呼ぶ
- `login` の型は `Usecase<{idToken: string, nonce: string}, {user: User, session: Session}>` — **本 PR で `rawSessionToken: string` を戻り値に追加する**
- `logout` は `Usecase<Session, void>`
- Session TTL は `Session.TTL_MS = 24h` (absolute、sliding なし)

### この PR の目的

1. **ADR 0005 の実装**: `sessions.token_hash` 列を追加し、cookie = raw / DB = `sha256` の分離を成立させる
2. Hono middleware を 3 つ追加: **session 復元** / **CSRF 検証** / **`Cache-Control: no-store`**
3. tRPC の `Context` を拡張し `protectedProcedure` を追加
4. `auth.startNonce` / `auth.login` / `auth.logout` / `auth.me` の 4 メソッドを tRPC ルーターに公開
5. `me` を完成 (PR 3 の skeleton を埋める)

### 設計の根拠

- **cookie = raw token / DB = sha256(raw) を別列**: ADR 0005。DB 単独漏洩で成りすましが成立しないようにする
- **session 復元 middleware**: Cookie から `__Host-sid` を読み、`sha256` → `Session.ByTokenHash` で DB lookup → `c.set('user', ...)` / `c.set('session', ...)`
- **CSRF middleware**: tRPC の mutation (POST) で `x-csrf-token` を検証。`Token.equals()` が内部で `timingSafeEqual` を使う
- **no-store middleware**: `/api/*` の全レスポンスに `Cache-Control: no-store, ...` を強制 (Cloudflare キャッシュ汚染防止)
- **`__Host-` prefix**: Cookie セキュリティ強化。Domain 指定不可、Path=/、Secure 必須
- **`SameSite=Lax`**: CSRF の第 1 線防御
- **`csrfToken` は Cookie に出さない** (XSS 耐性)、レスポンス body で渡し client memory に保持

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
- `server/src/presentation/trpc/handle-result.ts` — `Result<T,Fail>` → `TRPCError` 変換 (PR 78 で `UNAUTHORIZED` / `FORBIDDEN` 済)
- `server/src/usecases/context.ts` — Context 型 (PR 3 で `twitch` config 済、本 PR で `session?` / `user?` / `cookieJar?` 追加)
- `server/src/usecases/auth/{login,logout,startNonce,me}.ts` — PR 3 実装済の 4 usecase
- `server/src/models/{session,user}/index.ts` — Model 層
- `server/src/models/common/token.ts` — `Token` class (本 PR で `.hash()` メソッド追加)
- Hono Cookie API: `getCookie(c, name)`, `setCookie(c, name, value, options)`, `deleteCookie(c, name)` (`hono/cookie` から import)
- @trpc/server の `createMiddleware` / `procedure.use(...)`

### 1. ADR 0005 実装: schema + Model + Repository + Token.hash()

#### 1a. `schema/tables/sessions.sql`

`token_hash` 列を追加:

```sql
-- session row。cookie 値は DB に置かず sha256(raw) を token_hash に保管する (ADR 0005)。
-- csrf_token は base64url 平文で保管 (DB 単独漏洩では cookie と組でしか機能しないため、
-- 前回議論で平文維持で十分と判断)。
CREATE TABLE sessions (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,
  csrf_token   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
-- token_hash の UNIQUE 制約が自動で BTREE index を作るので追加 index は不要
```

pgschema は declarative なので既存 DB に対しては ALTER TABLE が発行される。token_hash 必須列を追加する際、既存の production session row は空になる (テスト段階なので consequence なし)。PR 4 を deploy する前に `sessions` を手動 TRUNCATE することを deploy 手順に記載する。

#### 1b. `server/src/models/common/token.ts` に `.hash()` 追加

```typescript
import { createHash } from "node:crypto";

// ...existing class...

export class Token {
  // ...existing members...

  /**
   * SHA-256 ハッシュを base64url で返す。セッション cookie の DB 照合用 (ADR 0005)。
   * 入力は内部 bytes (decode 済) に対してハッシュを取るため、
   * base64url の padding/alphabet ドリフトの影響を受けない。
   */
  hash(): string {
    const bytes = Buffer.from(this.value, "base64url");
    return createHash("sha256").update(bytes).digest("base64url");
  }
}
```

test: `Token.generate().hash()` の長さが 43 文字 (= sha256 32B を base64url no-padding)、同じ raw から同じ hash、異なる raw からは異なる hash。

#### 1c. `server/src/models/session/index.ts` を拡張

```typescript
export interface Session {
  id: string;
  userId: string;
  /** cookie 値 (raw Token) の sha256(base64url)。ADR 0005 参照。 */
  tokenHash: string;
  csrfToken: Token;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
}

export namespace Session {
  // TTL_MS 等は既存のまま

  const _specs = defineSpecs({
    ById: (id: string) => ({ id }),
    ByUserId: (userId: string) => ({ userId }),
    ByTokenHash: (hash: string) => ({ tokenHash: hash }),  // 追加
    ActiveAt: (at: Date) => ({ activeAt: at }),
    Expired: () => ({ expired: true as const }),
  });
  export const ById = _specs.ById;
  export const ByUserId = _specs.ByUserId;
  export const ByTokenHash = _specs.ByTokenHash;  // 追加
  export const ActiveAt = _specs.ActiveAt;
  export const Expired = _specs.Expired;

  export function create(params: {
    userId: string;
    /** 必須: 呼出側 (login usecase) が Token.generate() → .hash() で渡す。 */
    tokenHash: string;
    csrfToken?: Token;
    expiresAt?: Date;
    now: Date;
  }): Session {
    return {
      id: generateId(),
      userId: params.userId,
      tokenHash: params.tokenHash,
      csrfToken: params.csrfToken ?? Token.generate(),
      createdAt: params.now,
      expiresAt: params.expiresAt ?? new Date(params.now.getTime() + TTL_MS),
      lastSeenAt: params.now,
    };
  }
}
```

**注意**:
- `tokenHash` は model の内部状態として string (base64url sha256) を持つ。Token 型にはしない (もう cookie に出ない派生物なので raw Token class で包む意味なし)
- `Session.create` は raw を生成しない (責務分離: raw token の生成 / cookie へ出力は usecase / presentation 側)

#### 1d. `server/src/repositories/session/postgres/common.ts`

```typescript
export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  // ...dates
}

export function sessionSpecToSQL(spec: Session.Spec): SQLFragment {
  switch (spec.type) {
    case "ById":        return sql`id = ${spec.id}`;
    case "ByUserId":    return sql`user_id = ${spec.userId}`;
    case "ByTokenHash": return sql`token_hash = ${spec.tokenHash}`;
    case "ActiveAt":    return sql`expires_at > ${dateToSQL(spec.activeAt)}`;
    case "Expired":     return sql`expires_at <= now()`;
  }
}

export function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    csrfToken: Token.fromBase64url(row.csrf_token),
    createdAt: dateFromSQL(row.created_at),
    expiresAt: dateFromSQL(row.expires_at),
    lastSeenAt: dateFromSQL(row.last_seen_at),
  };
}
```

#### 1e. `server/src/repositories/session/postgres/upsert.ts`

INSERT に `token_hash` を追加、`ON CONFLICT (id)` 時の UPDATE は `token_hash` を触らない (cookie rotation は別 usecase で扱う)。

### 2. `server/src/usecases/auth/login.ts` に raw token 発行を組込む

戻り値を拡張:

```typescript
export const login = usecase({
  pre: (_ctx, input: { idToken: string; nonce: string }) => { /* 既存 */ },
  write: async (ctx, { idToken, nonce: nonceString }) => {
    // ...existing nonce consume, id_token verify, user upsert...

    // ADR 0005: raw token を発行 → hash を session に持たせる
    const rawToken = Token.generate();
    const session = Session.create({
      userId: user.id,
      tokenHash: rawToken.hash(),
      now: ctx.now,
    });
    await ctx.repos.session.upsert(session);

    // rawToken は cookie に出すためにだけ返す。session には入れない (DB に置かないのが ADR 0005 の核心)
    return { user, session, rawSessionToken: rawToken.toBase64url() } satisfies {
      user: User;
      session: Session;
      rawSessionToken: string;
    };
  },
});
```

既存 test も update: `result.value.rawSessionToken` が 43 文字 base64url である check を追加。

### 3. `server/src/usecases/context.ts` を拡張

```typescript
export interface SessionContext {
  id: string;
  userId: string;
  csrfToken: Token;  // Model から持ち上げたまま。toBase64url() は presentation で
  expiresAt: Date;
}

export interface UserContext {
  id: string;
  twitchUserId: string;
  login: string;
  displayName: string;
}

export interface CookieJar {
  set: (name: string, value: string, options: CookieOptions) => void;
  delete: (name: string, options: CookieOptions) => void;
}

export interface Context {
  now: Date;
  logger: ILogger;
  db: Database;
  rawRepos: Repos;
  repos: FullRepos<Repos>;
  twitch: TwitchConfig;  // PR 3 既存
  session?: SessionContext;
  user?: UserContext;
  cookieJar?: CookieJar;
}
```

**注意**:
- `session` / `user` / `cookieJar` は optional。tRPC context builder で Hono から詰める
- 既存 Phase Context 群 (PreContext / ReadContext 等) にも同じ field を追加するか要判断。基本方針: **usecase は ctx.session / ctx.user を直接参照しない** (protectedProcedure 側で narrow)。Phase Context への追加は見送り

### 4. `server/src/presentation/middleware/session.ts` を新規作成

```typescript
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { and, Token } from "../../models/common";
import { Session } from "../../models/session";
import { User } from "../../models/user";
import type { Context as AppContext } from "../../usecases/context";

export const SESSION_COOKIE_NAME = "__Host-sid";

export const createSessionMiddleware = (deps: { ctx: AppContext }) =>
  createMiddleware(async (c, next) => {
    const rawCookie = getCookie(c, SESSION_COOKIE_NAME);
    if (!rawCookie) return next();

    // ADR 0005: cookie 値は raw。DB lookup には sha256(raw) を使う。
    let tokenHash: string;
    try {
      tokenHash = Token.fromBase64url(rawCookie).hash();
    } catch {
      // cookie 値が base64url として解釈不能 → 未ログインとして扱う
      return next();
    }

    const now = new Date();
    const rCtx = createDbReadCtx(deps.ctx.db);
    const session = await deps.ctx.repos.session.get(
      rCtx,
      and(Session.ByTokenHash(tokenHash), Session.ActiveAt(now)),
    );
    if (!session) return next();

    const user = await deps.ctx.repos.user.get(rCtx, User.ById(session.userId));
    if (!user) {
      // user 削除済 — session も物理削除
      const wCtx = createDbWriteCtx(deps.ctx.db);
      await deps.ctx.repos.session.delete(wCtx, Session.ById(session.id));
      return next();
    }

    // last_seen_at touch (best effort、失敗しても先に進む)
    const wCtx = createDbWriteCtx(deps.ctx.db);
    deps.ctx.repos.session
      .upsert(wCtx, { ...session, lastSeenAt: now })
      .catch((err) => deps.ctx.logger.warn("session touch failed", { err }));

    c.set("session", {
      id: session.id,
      userId: session.userId,
      csrfToken: session.csrfToken,  // Token のまま
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
- `createDbReadCtx` / `createDbWriteCtx` は `@/repositories/common` から import
- touch の `upsert` は `token_hash` を含む entity そのままで OK (変わらないので)
- `Token.fromBase64url` は lenient decode だが、内部で正規化されるので canonical 比較で問題なし

### 5. `server/src/presentation/middleware/csrf.ts` を新規作成

```typescript
import { createMiddleware } from "hono/factory";
import { Token } from "../../models/common";

export const csrfMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const session = c.get("session");
  if (!session) {
    return next();  // 未ログイン mutation は protectedProcedure 側で 401 になる
  }

  const header = c.req.header("x-csrf-token");
  if (!header) {
    return c.json({ error: "csrf_token missing" }, 403);
  }

  let incoming: Token;
  try {
    incoming = Token.fromBase64url(header);
  } catch {
    return c.json({ error: "csrf_token malformed" }, 403);
  }
  if (!session.csrfToken.equals(incoming)) {
    return c.json({ error: "csrf_token mismatch" }, 403);
  }

  return next();
});
```

**注意**:
- `Token.equals()` は内部で長さチェック + `timingSafeEqual`。前回議論の timing 分析で OK と確定済
- `Token.fromBase64url` が throw するのは invalid UTF-8 などの edge case のみ。非 base64 chars は lenient に decode される

### 6. `server/src/presentation/middleware/no-store.ts` を新規作成

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

test: `/api/*` 配下のレスポンスに上記 3 header が付与されることを確認。

### 7. `server/src/presentation/trpc/init.ts` に `protectedProcedure` 追加

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
    ctx: { ...ctx, user: ctx.user, session: ctx.session },
  });
});
```

### 8. `server/src/usecases/auth/me.ts` を完成

現状 skeleton (`Usecase<{user, session}, {user, session}>`)。presentation 層の形に合わせた軽量 handler に置換:

```typescript
import type { SessionContext, UserContext } from "../context";

export interface MeResult {
  user: UserContext;
  csrfToken: string;  // presentation 境界で base64url 化
}

export function meHandler(user: UserContext, session: SessionContext): MeResult {
  return {
    user,
    csrfToken: session.csrfToken.toBase64url(),
  };
}
```

runner を使わない。既存の `me.ts` skeleton は削除 or 置換。

### 9. `server/src/presentation/trpc/routers/auth.ts` を新規作成

```typescript
import { z } from "zod";
import { handleResult } from "../handle-result";
import { publicProcedure, protectedProcedure, router } from "../init";
import { login } from "@/usecases/auth/login";
import { logout } from "@/usecases/auth/logout";
import { startNonce } from "@/usecases/auth/startNonce";
import { meHandler } from "@/usecases/auth/me";
import { SESSION_COOKIE_NAME } from "@/presentation/middleware/session";
import { Session } from "@/models/session";

export const authRouter = router({
  startNonce: publicProcedure.mutation(async ({ ctx }) => {
    const result = await startNonce.run(ctx);
    const nonce = handleResult(result);
    return { nonce: nonce.nonce.toBase64url() };
  }),

  login: publicProcedure
    .input(z.object({
      idToken: z.string().min(1),
      nonce: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await login.run(ctx, {
        idToken: input.idToken,
        nonce: input.nonce,
      });
      const value = handleResult(result);

      // ADR 0005: cookie には raw token のみ、DB には hash のみ
      ctx.cookieJar?.set(SESSION_COOKIE_NAME, value.rawSessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        maxAge: Math.floor(Session.TTL_MS / 1000),
      });

      return {
        user: {
          id: value.user.id,
          twitchUserId: value.user.twitchUserId,
          login: value.user.login,
          displayName: value.user.displayName,
        },
        csrfToken: value.session.csrfToken.toBase64url(),
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // logout は Session Model を入力に取る。Session model の完全体が必要なため
    // session middleware が既に resolve した値を使う案もあるが、
    // DB lookup が必要なケースを避けて直接 delete する
    const result = await logout.run(ctx, {
      // Session 完全体再構築は不要、Session.ById(ctx.session.id) で delete できる
      // → logout usecase の input 型を Session.ById spec または session.id 単体に変えるのも選択肢
      // 本 PR では既存の logout Usecase<Session, void> 契約に合わせる。SessionContext から
      // Session への最小フィールド補完は middleware 側で行う (Session 全列を c.set する)
      ...(ctx as any)._fullSession,  // 実装方針は「9a」参照
    });
    handleResult(result);

    ctx.cookieJar?.delete(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true as const };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return meHandler(ctx.user, ctx.session);
  }),
});
```

#### 9a. logout の入力契約の再検討

現 `logout` は `Usecase<Session, void>` — Session 完全体を要求する。middleware が resolve するのは `SessionContext` (id/userId/csrfToken/expiresAt) で **完全な Session ではない** (tokenHash / createdAt / lastSeenAt が落ちる)。

選択肢:

1. **logout の input を session.id に変更** (`Usecase<{ sessionId: string }, void>`): delete は `Session.ById(sessionId)` で足りるので最小契約
2. **middleware で Session 完全体を `c.set("fullSession", ...)` する**: session endpoint 以外で完全体が不要なのでもったいない
3. **SessionContext を Session 全列に拡張**: UserContext と非対称になる (UserContext は User 全列を持たない) ので微妙

**推奨: 選択肢 1**。logout の input を `{ sessionId: string }` に変更し、middleware が resolve した `ctx.session.id` を渡す。PR 3 で決めた「logout の input は Session 全体」という判断を再考して session.id のみに縮小する。これは **PR 3 の logout.ts と test を 2 箇所微修正するだけ** で済む。

### 10. tRPC の context builder で Hono context を注入

`server/src/presentation/index.ts` か `trpc/init.ts` に:

```typescript
import { setCookie, deleteCookie } from "hono/cookie";
import { trpcServer } from "@hono/trpc-server";

app.use("/api/trpc/*", trpcServer({
  router: appRouter,
  createContext: (_opts, c) => ({
    ...ctx,
    session: c.get("session"),
    user: c.get("user"),
    cookieJar: {
      set: (name, value, options) => setCookie(c, name, value, options),
      delete: (name, options) => deleteCookie(c, name, options),
    },
  }),
}));
```

### 11. `server/src/presentation/trpc/routers/index.ts` を更新

```typescript
import { router } from "../init";
import { authRouter } from "./auth";

export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
```

### 12. `server/src/presentation/index.ts` に middleware 配線

配線順序:

```typescript
app.get("/health", (c) => c.json({ status: "ok" }));

// /api/* にだけ適用する middleware 群
const sessionMiddleware = createSessionMiddleware({ ctx });
app.use("/api/*", noStoreMiddleware);
app.use("/api/*", sessionMiddleware);
app.use("/api/*", csrfMiddleware);

// tRPC server
app.use("/api/trpc/*", trpcServer({ /* ... step 10 参照 ... */ }));
```

Hono `ContextVariableMap` の module augmentation も忘れずに:

```typescript
declare module "hono" {
  interface ContextVariableMap {
    session?: SessionContext;
    user?: UserContext;
  }
}
```

---

## テスト

### Unit Test
- `server/src/models/common/token.test.ts` — `Token.hash()` の長さ / 同値 / 異値のケース
- `server/src/models/session/index.test.ts` (追加) — `Session.ByTokenHash` spec
- `server/src/repositories/session/postgres/index.test.ts` (拡張) — token_hash 列の round-trip
- `server/src/usecases/auth/login.test.ts` (拡張) — `result.value.rawSessionToken` が 43 文字、session.tokenHash が hash 済
- `server/src/presentation/middleware/session.test.ts` — cookie あり/無し、有効 session、無効 hash、user 削除済のケース
- `server/src/presentation/middleware/csrf.test.ts` — GET skip、POST + header なし → 403、POST + 不一致 → 403、POST + 一致 → pass
- `server/src/presentation/middleware/no-store.test.ts` — `/api/*` レスポンス header の確認
- `server/src/presentation/trpc/routers/auth.test.ts` — 4 endpoint の入出力 (任意)

### Manual Verification

```bash
# 1. nonce 取得
curl -X POST http://localhost:3000/api/trpc/auth.startNonce
# → { result: { data: { nonce: "..." } } }

# 2. login は id_token fixture が必要なので後続 PR の e2e で検証

# 3. UNAUTHORIZED
curl http://localhost:3000/api/trpc/auth.me
# → { error: { code: "UNAUTHORIZED" } }

# 4. no-store header
curl -I http://localhost:3000/api/trpc/auth.me
# → Cache-Control: no-store, ... / Vary: Cookie, Authorization
```

---

## Definition of Done

- [x] **ADR 0005 実装**: `schema/tables/sessions.sql` に `token_hash` 列追加、`Session.tokenHash` / `Session.ByTokenHash` / `Token.hash()` 追加、Repository の read/write 対応
- [x] `login.ts` が `rawSessionToken` を戻り値に含める
- [x] `logout` の入力を `{ sessionId: string }` に縮小
- [x] `server/src/usecases/context.ts` に `session?` / `user?` / `cookieJar?` 追加
- [x] `server/src/presentation/middleware/{session,csrf,no-store}.ts` 作成 + test
- [x] `server/src/presentation/trpc/init.ts` に `protectedProcedure` 追加
- [x] `server/src/usecases/auth/me.ts` を `meHandler` に置換
- [x] `server/src/presentation/trpc/routers/auth.ts` 作成 (4 endpoint)
- [x] `server/src/presentation/trpc/routers/index.ts` で `auth` 統合
- [x] `server/src/presentation/index.ts` に middleware 配線、CSP は既存維持
- [x] tRPC context builder で Hono context (`c`) を注入 → `cookieJar` 抽象を埋める
- [x] `CLAUDE.md` に schema NOT NULL 列追加時の migration 落とし穴を注記 (`sessions.token_hash` の前例を含む)
- [x] `bun run check` 全緑
- [x] `bun run build` 成功
- [x] 手動確認相当: `presentation/index.test.ts` で `auth.startNonce` が nonce を返す / `auth.me` が UNAUTHORIZED を返す / `Cache-Control: no-store` が付与されることを integration test として固定

---

## 既知の落とし穴

- **tRPC から Cookie 設定する設計**: `cookieJar` 抽象を `createContext` callback で注入するのが最もシンプル。router 内で `ctx.cookieJar?.set/delete` を呼ぶ
- **Hono `ContextVariableMap` の型拡張**: `declare module "hono"` で module augmentation が必要
- **CSP の `connectSrc`**: `'self'` + `'https://api.twitch.tv'` を維持 (client が引き続き Twitch 直接通信)
- **CSRF middleware の skip 条件**: 未ログイン mutation (`auth.startNonce` / `auth.login`) は `session` が無いので `if (!session) return next()` で skip される。実装済みの条件分岐を変えないこと
- **tRPC batch link の扱い**: tRPC v11 の httpBatchLink は複数 mutation を 1 HTTP request にまとめるが、CSRF middleware は request 単位で 1 度だけ検証すれば足りる (全 mutation に同じ csrf header が使われる前提)
- **`csrfToken` は Cookie に出さない**: login response body のみで返す。cookie に出すと CSRF double-submit の意義が失われる
- **`__Host-` prefix の制約**: Domain 属性不可、`Path=/`、`Secure` 必須。`Secure` のため HTTP localhost では set されない → 開発は HTTPS 化 (`mkcert`) を推奨、暫定 `secure: process.env.NODE_ENV === "production"` で switching
- **session touch 失敗**: best effort で握り潰す (logger.warn のみ)。touch の成否は session 有効性に影響しない
- **`@hono/trpc-server` version**: 既存の `^0.4.2` で `createContext` が `(opts, c)` の 2 引数でくる API を確認
- **Session.create 引数の破壊的変更**: 本 PR で `tokenHash` 必須化。`createTestSession` factory と既存 repo test を合わせて修正
- **Deploy 時の session 失効**: `token_hash NOT NULL` を追加すると既存 row の migration が fail するため、事前に `TRUNCATE sessions` が必要。production に session が溜まる前段階なので運用的影響は小
