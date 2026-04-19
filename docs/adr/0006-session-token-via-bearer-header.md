---
id: "0006"
title: "session token は Authorization: Bearer ヘッダで運び client は sessionStorage に保管する"
status: "accepted"
date: "2026-04-19"
supersedes: "0005"
superseded_by: null
related_specres: []
tags: ["auth", "security", "session", "cookie"]
---

## コンテキスト

[ADR 0005](./0005-session-cookie-hashed-at-rest.md) で「cookie = raw 32B トークン、DB = sha256 ハッシュ」の分離保管を採用した。しかし PR 6 の client 実装中に以下の多重問題が顕在化した:

1. **HttpOnly Cookie の寿命と `sessionStorage` の寿命の不一致**  
   access_token は sessionStorage に保管 (tab close で消滅) だが、session cookie は 24h 有効 (ADR 0005 で絞ったが依然 tab close では消えない)。tab を再度開くと「Twitch session 無し・server session 有り」の乖離が発生し、client が UI を立ち上げるたびに stale な cookie を整理する必要がある

2. **`__Host-` prefix の HTTPS 必須制約**  
   `Secure=true` 必須のため HTTP localhost で cookie が保存されず、開発で `NODE_ENV` による切替が必要

3. **`@hono/trpc-server` の Response 置換**  
   tRPC handler が新 Response を直接返すため、procedure 内の `setCookie(c, ...)` が消える。独自 wrapper で `c.res.headers.getSetCookie()` を salvage する必要があった

4. **CSRF middleware の複雑化**  
   Cookie が自動送信されるため CSRF double-submit が必要 → csrfToken を DB 列に持つ → login response に csrfToken を返す → client memory に保持 → mutation ごとに X-CSRF-Token header を付ける、の複雑度を背負っていた

5. **stale cookie / csrfToken タイミング問題**  
   startNonce は mutation だが認証前に呼ぶ必要がある。stale cookie が残っていると CSRF middleware が 403 を返して認証フローに入れない、という循環が発生する

これらの根底は「server session cookie の寿命が access_token と独立」という ADR 0005 の構造的な帰結。アプリ上、server session だけ生きていても Twitch トークンが無ければ使えない (Twitch API を呼べない) ため、この乖離状態に価値が無い。

## 検討した選択肢

### 案A: ADR 0005 のまま続行 (Cookie + CSRF 維持) (却下)

- **メリット**
  - XSS 耐性が高い (HttpOnly で JS から読めない)

- **デメリット**
  - 寿命不一致・tab 固有性の差・CSRF 複雑度・`@hono/trpc-server` 統合の歪みをすべて抱え続ける
  - XSS 耐性の恩恵は本プロジェクトでは小さい: Twitch access_token が既に sessionStorage で露出しており (ADR 0002)、XSS 成立時点で Twitch API 全権を奪われる既存リスクを受容済み。server session だけ HttpOnly で守っても攻撃者は access_token 経由で十分成り立つ

### 案B: session token を sessionStorage + `Authorization: Bearer` で運ぶ (採用)

- **保管場所**: `sessionStorage` の `"sid"` key (Twitch access_token の `"twitch-auth"` と同じ store)
- **転送**: `Authorization: Bearer <raw>` header を tRPC link で自動付与
- **DB 保管**: `sessions.token_hash` に `sha256(raw)` (ADR 0005 の核は継承)

- **メリット**
  - **寿命が Twitch access_token と揃う** — tab close で両方消滅、再開時は必ずクリーンスタート。stale 状態が原理的に発生しない
  - **CSRF 不要**: Bearer は browser 自動転送されないので、cross-site attacker が被害者の認証情報を勝手に付けることができない (CORS preflight が custom header を弾く)。CSRF middleware / csrfToken 列 / X-CSRF-Token header を全て撤廃できる
  - **`@hono/trpc-server` と素直に統合** — cookie を跨ぐ wrapper が不要、procedure も Hono context を触らない
  - **`__Host-` prefix / Secure 切替 / SameSite / domain 指定** のブラウザ仕様周りが全て不要

- **デメリット**
  - **XSS で sid を exfiltrate される**: sessionStorage は JS 可読。XSS 成立時は sid が攻撃者の server に送信され、24h (session TTL) 間 replay 可能。ただし access_token もまた sessionStorage 露出 (ADR 0002) なので「XSS 耐性」は既に弱く、この変更の純粋な劣化は小さい
  - **multi-tab の挙動**: sessionStorage は tab ごとに独立なので、複数 tab では各々独立 session。ただし access_token も同じく tab 固有なので実質 regression なし

### 案C: 完全 stateless (JWT を client 保管、DB lookup 廃止) (却下)

- **メリット**: DB 不要
- **デメリット**: 即時 revoke 不能、鍵ローテーションが重い。本プロジェクトに合わない

## 決定

**案B を採用する**。ADR 0005 の「DB は sha256 で保管」の核原則は継承し、raw token の delivery layer だけを cookie → `Authorization: Bearer` header に差し替える。

### 実装変更サマリ

| 項目 | 前 (ADR 0005) | 後 (本 ADR) |
|---|---|---|
| raw token の client 保管場所 | `__Host-sid` HttpOnly Cookie | `sessionStorage["sid"]` |
| raw token の転送 | Cookie 自動送信 | `Authorization: Bearer <raw>` header (tRPC link が手動付与) |
| DB 保管 | `sessions.token_hash TEXT UNIQUE` (sha256) | **変更なし** |
| CSRF 対策 | middleware + double-submit csrfToken | **不要** (bearer は自動転送されない) |
| `sessions.csrf_token` 列 | 必要 | **削除** |
| Session model の `csrfToken` field | 必要 | **削除** |
| CookieJar 抽象 / tRPC wrapper | 必要 | **削除** |
| `__Host-` prefix / Secure / SameSite | 必要 | **不要** |
| 寿命 | cookie 24h TTL | `sessionStorage` 寿命 ≦ 24h (DB 側 TTL は上限保証として残す) |

## 帰結

### 良い帰結

- stale cookie 問題が消滅 (Twitch token と session token が同ライフサイクル)
- 認証系の各種中間層 (CSRF middleware / CookieJar / cookie wrapper) を削除できる
- tRPC + Hono の公式パターンから逸脱せず、procedure 内で Hono context を触る必要もなくなる
- ADR 0005 の「DB は hash」核原則は不変で、DB 単独漏洩の耐性は保たれる

### 悪い帰結

- XSS 成立時に server session token が exfiltrate される。ただし access_token も同様に露出 (ADR 0002) なので実効的な degrade は小さい
- multi-tab で session が共有されない。ただし access_token も同様なので regression ではない
- ADR 0005 の主決定 (raw の保管場所は cookie) は形式的に supersede される (DB=hash の部分は継承)

### 影響範囲

- `schema/tables/sessions.sql` — `csrf_token` 列を削除
- `server/src/models/session/index.ts` — `csrfToken` field 削除
- `server/src/models/common/token.ts` — `.hash()` は継続利用
- `server/src/repositories/session/postgres/{common,upsert}.ts` — `csrf_token` 列の read/write 撤去
- `server/src/usecases/auth/login.ts` — `rawSessionToken` を応答 body で返すのは継続
- `server/src/usecases/auth/me.ts` — `MeResult` から `csrfToken` 削除
- `server/src/presentation/middleware/session.ts` — `Authorization: Bearer` header から raw を読む
- `server/src/presentation/middleware/csrf.ts` — **削除**
- `server/src/presentation/index.ts` — `cookieJar` / cookie wrapper / csrfMiddleware を撤去、単純な `trpcServer(...)` に戻す
- `server/src/presentation/trpc/routers/auth.ts` — login 応答に `sid` を body で返す、logout は DB delete のみ
- `server/src/usecases/context.ts` — `CookieJar` / `cookieJar` を削除、`SessionContext.csrfToken` を削除
- `client/src/trpc/client.ts` — `Authorization: Bearer` header を tRPC link で付与、`credentials` 送信は不要
- `client/src/TwitchAuth/provider.tsx` — sid を sessionStorage に保管、logout で両方クリア
- `docs/plans/04-*.md` / `06-*.md` — Bearer ベースに書き換え
- `docs/plans/00-overview.md` — セキュリティモデル表の sessionハイジャック / DB 漏洩 row を更新
- ADR 0005 の `status` を `superseded` に更新し `superseded_by: "0006"` を追記

## 参照

- `docs/plans/00-overview.md`
- `docs/plans/04-trpc-middleware-and-auth-router.md`
- `docs/plans/06-frontend-trpc-client-and-auth.md`
- ADR-0002 (Twitch トークンを DB 保存しない)
- ADR-0005 (session cookie は raw / DB は sha256、本 ADR が supersede)
