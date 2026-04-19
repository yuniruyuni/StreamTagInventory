---
id: "0007"
title: "サーバー側 session を廃止し Twitch id_token を毎回検証する Bearer 認証にする"
status: "accepted"
date: "2026-04-19"
supersedes: "0006"
superseded_by: null
related_specres: []
tags: ["auth", "security", "session", "jwt", "stateless"]
---

## コンテキスト

[ADR 0006](./0006-session-token-via-bearer-header.md) で「raw session token を `Authorization: Bearer` で送る + DB は sha256」の構成に切り替えたが、PR 6 の client 実装で以下が顕在化した:

1. **二重 storage の race**  
   client が sessionStorage に持つもの: `twitch-auth` (Twitch access_token) と `sid` (server session)。両者は独立に書き込まれるため、login mutation 完了前に setToken → meQuery の enable 化 → Bearer 不在で 401 → cleanup フローに落ちる、という timing 依存のバグが発生した。fix を重ねたが構造的に再発しやすい

2. **logout / startNonce / login の各 mutation が連鎖した state machine**  
   `loginFiredRef` / `startNonceFiredRef` の二重ガードで Phase 1〜3 を制御しており、ref の reset タイミングを 1 箇所間違えるだけで「Loading 無限待ち」「Entrance への bounce」「nonce missing」等の異なる症状が出る

3. **server 側 session の存在価値の希薄さ**  
   そもそも本ツールは「Twitch access_token が無いと何もできない」 (Twitch API 呼出が必須機能)。server session が単独で生きていてもユーザーには無意味。にも関わらず session table / nonce table / login / logout / startNonce の usecase 群を背負っている

4. **nonce の DB consume も用途が限定的**  
   nonce の本来の役割は「id_token を特定の authorize 要求に紐付ける」こと = client 側で id_token claim と stored nonce を照合すれば足りる。サーバー側で atomic delete する replay 防止は、bearer credential の流出耐性の話と独立で、本ツールの脅威モデルでは過剰

ADR 0006 で得たかった「stale 状態の排除」は達成したが、構造そのもの (server session を保持) の重量がまだ問題を引きずっている。

## 検討した選択肢

### 案A: ADR 0006 のまま続行 (server session 維持) (却下)

- **メリット**
  - 即時 revoke 可能 (DB から session 行を delete すれば該当 client は次のリクエストで 401)
  - server で session 寿命を強制できる

- **デメリット**
  - 二重 storage の race を抱え続ける。ガード ref の管理ミスで再発を繰り返している
  - 個人配信者向けの単一 user セッションで「即時 revoke」の運用ニーズが無く、メリットが理論上のもの
  - DB schema (sessions, oidc_nonces) と usecase (login, logout, startNonce) を維持するコストが大きい

### 案B: server session を廃止し id_token を毎リクエスト検証 (採用)

- **client**
  - Twitch implicit hybrid flow で取得した id_token を `sessionStorage["twitch-id-token"]` に保管
  - access_token は従来通り `sessionStorage["twitch-auth"]` (用途: Twitch API 直接呼出)
  - tRPC link で `Authorization: Bearer <id_token>` を自動付与
  - nonce は **クライアントで生成** (`crypto.randomUUID`) → sessionStorage に保管 → authorize URL に埋込 → callback で id_token claim と照合 (mismatch なら reject)

- **server**
  - 全 `/api/*` 経路の middleware で `Authorization: Bearer <jwt>` を読み、`jose.jwtVerify` で署名 / iss / aud / exp 検証
  - `sub` claim (Twitch user id) で users 表を find-or-create し、`UserContext` を ctx.user に inject
  - **session table 廃止**, **oidc_nonces table 廃止**, **login/logout/startNonce 廃止**

- **メリット**
  - 二重 storage が解消 (id_token 一つで「Twitch identity 持ち = ログイン状態」が決まる)
  - state machine が「id_token あり/なし」の 2 値に縮約。Phase 1 mutation が消えて race の温床が無くなる
  - DB から sessions / oidc_nonces を削除でき、schema が users + template_docs の 2 表になる
  - nonce の atomic consume を諦める代わりに、replay 防止は id_token の `exp` (Twitch 既定で 1 時間) と client 側 nonce 照合で十分まかなえる
  - Twitch session が切れたら id_token も寿命切れになり、自動的に再認証が要求される

- **デメリット**
  - 即時 revoke 不能 — 不審 session を server から強制終了できない。本ツール (個人配信者向け) では運用要件が無いため受容
  - id_token の bandwidth — JWT は 1〜2KB で、毎リクエストに乗る。tRPC batch 内 1 回なので実用上問題なし
  - 毎リクエストで JWT verify (署名検証) — JWKS は jose 内部で cache されるため CPU 負荷は ms 単位。低トラフィックの本ツールでは無視できる
  - id_token 寿命 (~1h) で自動 logout 体感が発生 — 長時間操作中に再認証が要求される。要 UX 配慮 (sessionStorage の id_token を `exp` で proactive 失効 → Entrance に戻す)
  - **id_token を XSS で奪われた場合**, `exp` まで replay 可能。これは ADR 0006 の sid が同じ条件で奪われる場合と等価で実効的な regression なし

### 案C: server side で nonce のみ atomic 検証し session 表は廃止 (却下)

- **メリット**
  - replay 防止が server 側で担保される

- **デメリット**
  - oidc_nonces table と startNonce/login の往復が残るため、二重 storage の race の半分しか解消しない
  - 本ツールの脅威モデルでは「id_token が一度しか使われないこと」を server で強制する価値が薄い (盗まれた時点で `exp` まで悪用可能なのは案 B と同じ)

## 決定

**案B を採用する**。server を完全 stateless 化し、Twitch id_token を per-request 検証する。session / oidc_nonces 系の table / model / repo / usecase / middleware を撤去。

### ADR 0006 との関係

ADR 0006 の核 (「raw token は sessionStorage、転送は Authorization: Bearer」) は本 ADR でも継承する。違うのは「raw token = 自前発行の 32B」から「raw token = Twitch id_token」になる点と、それに伴う server 側状態の全廃止。ADR 0006 は本 ADR で `superseded` 扱いとする。

### 実装変更サマリ

| 項目 | 前 (ADR 0006) | 後 (本 ADR) |
|---|---|---|
| client が保管する token | `sid` (32B raw) + `twitch-auth` (access_token) | `twitch-id-token` (JWT) + `twitch-auth` (access_token) |
| Authorization: Bearer の中身 | サーバー発行の sid | Twitch 発行の id_token |
| サーバー側の session table | あり | **削除** |
| oidc_nonces table | あり (server で atomic consume) | **削除** (nonce は client local) |
| auth.startNonce / login / logout | あり | **すべて削除** |
| auth.me | session middleware が resolve した user | JWT middleware が resolve した user |
| session middleware | sid → DB lookup で session/user 復元 | id_token → JWT 検証 + users find-or-create で user 復元 |
| nonce 検証 | server (DB delete with row count) | client (sessionStorage 値と id_token nonce claim の文字列比較) |
| 即時 revoke | DELETE FROM sessions ... | 不可 (id_token の exp まで replay 可能) |
| id_token TTL に対する取扱 | server session が独自 TTL (24h) で支配 | id_token の exp (~1h) がそのまま session 寿命 |

## 帰結

### 良い帰結

- client provider の state machine が「id_token あり / なし」の 2 値に縮約。Phase 1 (login mutation) と Phase 3 (startNonce mutation) が消えて Phase 2 (token あり / me 401 → cleanup) のみになる。race を生む同時状態が原理的に存在しない
- server から sessions / oidc_nonces 関連コード一式が削除でき、schema は users + template_docs の 2 表で完結
- 認証系の重さが大幅に下がる。新規 PR や e2e mock を書くコストも下がる
- ログ / 監視で「Twitch identity = id_token sub」が一意に追えるため運用も簡素化

### 悪い帰結

- 即時 revoke の能力を失う。本ツール (個人配信者用 1 user テナント) では受容
- id_token の `exp` (Twitch 既定 1h) が session 寿命となり、長時間使用で自動 logout が発生する。`exp` を見て proactive に Entrance に戻す UX 実装が必要
- ADR 0005 / 0006 の「DB は sha256 hash」核原則は本 ADR で消滅 (そもそも DB に session を持たないため)。代わりに id_token (JWT) は DB に格納されない = 漏洩耐性は維持

### 影響範囲

- **schema**:
  - `schema/tables/sessions.sql` 削除
  - `schema/tables/oidc_nonces.sql` 削除
- **server**:
  - `server/src/models/session/` 削除
  - `server/src/models/oidcNonce/` 削除
  - `server/src/repositories/session/` 削除
  - `server/src/repositories/oidcNonce/` 削除
  - `server/src/repositories/index.ts` から session / oidcNonce を撤去
  - `server/src/usecases/auth/login.{ts,test.ts}` 削除
  - `server/src/usecases/auth/logout.{ts,test.ts}` 削除
  - `server/src/usecases/auth/startNonce.{ts,test.ts}` 削除
  - `server/src/usecases/auth/me.ts` — JWT context をそのまま返す (実質変更なし)
  - `server/src/usecases/context.ts` — `SessionContext` 削除、`Context.session` 削除
  - `server/src/presentation/middleware/session.{ts,test.ts}` を `jwt-auth.{ts,test.ts}` に置換 — id_token verify + users find-or-create
  - `server/src/presentation/trpc/init.ts` — `protectedProcedure` の guard を `ctx.user` のみに
  - `server/src/presentation/trpc/routers/auth.ts` — `me` のみ。`startNonce` / `login` / `logout` 撤去
  - `server/src/presentation/index.ts` — middleware 差し替え、CSP の connectSrc 等は不変
  - `server/src/infra/twitch/verify-id-token.ts` — `expectedNonce` パラメータ削除 (nonce は client 側担当)
- **client**:
  - `client/src/TwitchAuth/provider.tsx` — Phase 1 (login mutation) / Phase 3 (startNonce mutation) を削除し、callback で id_token を取り込む / nonce 照合する単純なフローに置換
  - `client/src/trpc/client.ts` — `Authorization: Bearer ${idToken}` を sessionStorage から付与
  - `client/src/TwitchAuth/utils.ts` — id_token nonce の peek (jose の `decodeJwt` 等) と nonce 生成ヘルパを追加
  - `client/src/auth/twitch.ts` — `getEntranceUri` の nonce 生成は client 側で行う既存パスを継続利用
- **plans**:
  - `docs/plans/00-overview.md` — セキュリティモデル / DB スキーマ概要 / シーケンス記述を更新
  - `docs/plans/03-twitch-jwks-and-auth-usecases.md` — startNonce/login/logout 撤去
  - `docs/plans/04-trpc-middleware-and-auth-router.md` — JWT middleware に書き換え
  - `docs/plans/06-frontend-trpc-client-and-auth.md` — provider 設計を更新
- **ADR**:
  - ADR 0006 を `superseded` に更新し `superseded_by: "0007"` を追記
  - ADR 0005 はすでに ADR 0006 で superseded 済 (本 ADR では不変)

## 参照

- `docs/plans/00-overview.md`
- ADR-0002 (Twitch トークンを DB 保存しない — 本 ADR でも継承)
- ADR-0005 (session cookie / DB hash — ADR 0006 で superseded)
- ADR-0006 (raw session token を Authorization: Bearer + sessionStorage — 本 ADR で superseded)
