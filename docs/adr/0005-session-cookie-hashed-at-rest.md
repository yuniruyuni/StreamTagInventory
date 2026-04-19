---
id: "0005"
title: "session cookie は raw 32B トークン、DB は SHA-256 ハッシュで分離保管する"
status: "superseded"
date: "2026-04-19"
supersedes: null
superseded_by: "0006"
related_specres: []
tags: ["auth", "security", "cookie"]
---

## コンテキスト

PR 3 で auth usecase 層 (`login` / `logout` / `me` / `startNonce`) を導入し、次の PR 4 で Hono middleware 経由の session 復元と Cookie 発行を行う。

ここで「session cookie の value は何にするか」「DB 上でそれをどう照合するか」を決定する必要がある。選択によって **DB 漏洩時の blast radius が大きく変わる**。

現状の `sessions` schema:

- `id UUID PRIMARY KEY`
- `csrf_token TEXT NOT NULL` (raw base64url)
- `user_id` FK / `created_at` / `expires_at` / `last_seen_at`

session の寿命は 24h absolute (ADR 0005 と並行で Model に集約済、`Session.TTL_MS`)。

主な脅威想定:

- `pg_dump` 等のバックアップ流出
- DB read-only SQL injection (WAF すり抜けの compound attack)
- 運用担当者の悪意 / 誤操作による DB dump
- Cloud Run 同居コンテナからの予期せぬ DB 読取り

## 検討した選択肢

### 案A: cookie = `session.id` そのまま、DB も平文保管

- Cookie `__Host-sid` の value = `session.id` (UUID そのまま)
- Middleware: `getCookie(c, "__Host-sid")` → `Session.ById(id)`

**メリット**
- 実装最小 (1:1 対応)
- debug 容易

**デメリット**
- **DB 漏洩単独で即全ユーザーなりすまし成立**。24h 以内の全 active session の UUID を攻撃者が取得 → cookie に貼れば完了
- Django / Laravel など一部 framework は事実上これを採用しているが、本プロジェクトでは Cloud SQL の backup 流出を脅威モデルに含めており許容できない

### 案B: cookie = HMAC 署名付き session.id、DB は平文保管

- Cookie value = `session.id || "." || hmac(session.id, K)`
- Middleware: HMAC 検証 → session.id 抽出 → `Session.ById`
- サーバ側に永続 secret `K` を持つ

**メリット**
- DB 単独漏洩では cookie 偽造不可 (`K` が別途必要)

**デメリット**
- secret `K` の管理 (env / Secret Manager / 漏洩時の全 session 失効手続き)
- `K` のローテーションが痛み (全ユーザー強制ログアウト)
- 運用実態として DB と env は同一 Cloud Run インスタンスから見えるため、実効的防御範囲が狭い (同時漏洩しがち)

### 案C: cookie = 暗号化された session blob (stateless, JWE / Iron / Rails signed cookie 方式)

- Cookie が自己完結、DB lookup 不要

**メリット**
- DB 漏洩が無意味 (DB そもそも session lookup に使わない)
- レイテンシ改善 (DB round-trip 不要)

**デメリット**
- 個別 session の即時 revoke 不可 (rotation か revocation list が必要)
- 鍵管理が複雑 (鍵の scope, rotation policy, JWE alg 選定)
- logout の「即時無効化」を自前で再設計する必要あり (blacklist 等)
- 既にある `sessions` テーブルの意義が失われる

### 案D: cookie = raw 32B トークン、DB = `sha256(cookie)` を別列保管 (採用)

- `login` usecase で `Token.generate()` により raw 32B を生成
- DB は `sessions.token_hash TEXT UNIQUE NOT NULL` 列に `sha256(raw)` を保存
- Cookie 発行時のみ client に raw を渡し、サーバ側はそれ以降 raw を保持しない
- Middleware: `raw = getCookie(...)` → `hash = sha256(raw)` → `Session.ByTokenHash(hash)`
- `session.id` は UUID のまま (FK / 内部参照 / 監査ログ用)

**メリット**
- **DB 漏洩 → 攻撃者は hash のみ保持 → 256 bit の preimage 探索 (2^256) は現実的に不可能**。blast radius が事実上ゼロ
- 追加 secret なし (HMAC 不要)、key rotation の運用負担ゼロ
- `session.id` を UUID のまま維持するため、FK / 監査用途を保てる
- 業界的にも API key / GitHub PAT / Rails `secure_compare` ベース設計と同じ考え方
- 比較は DB 側が BTREE 等値 index で定数時間、timing attack 耐性あり

**デメリット**
- `sessions` テーブルに列 1 つ + UNIQUE index 1 つが増える
- Model / Repository / middleware に「hash 化」の 1 step が増える (~30 行規模)
- 生 token は login 応答時の 1 回だけ存在する (rotate / 再表示 不能。仕様として許容)

## 決定

**案D を採用する**。

核心: **DB に置くのは「cookie 値そのもの」ではなく「cookie 値の検証に使える派生物」**、という責務分離。これにより:

1. **DB 単独漏洩で即 session 侵害される最悪ケースを閉じる**
2. **追加 secret を持たない** (HMAC 鍵管理や ローテの運用負担を避ける)
3. `session.id` を UUID のまま FK 等に使える

Cookie 自体のセキュリティ属性 (HttpOnly / Secure / SameSite=Lax / `__Host-` prefix) は別レイヤの防御であり、本 ADR と独立に維持する。

## 帰結

### 良い帰結

- DB 漏洩時の blast radius を「hash の集合」に限定 (= 事実上ゼロ)
- `session.id` UUID 設計を維持するため、他テーブルからの FK / 管理画面からの参照 / audit log が将来自然に書ける
- Rotation 不要 (secret が存在しない)
- `csrf_token` を平文保管する妥当性 (前回の議論で整理済: cookie と複合でしか機能しない) と整合: cookie 側が hash で守られていれば、DB 漏洩単独では「session + CSRF の両取り」攻撃も成立しない

### 悪い帰結

- Schema / Model / Repository / middleware に +α の実装 (約 30 行、PR 4 に吸収)
- `token_hash` から user を特定する逆引きは (設計通り) 不可能 → 管理で特定 session を追う場合は `user_id` + `created_at` / `last_seen_at` から絞る運用

### 影響範囲

- `schema/tables/sessions.sql` — `token_hash TEXT UNIQUE NOT NULL` 列 + UNIQUE index を追加
- `server/src/models/session/index.ts` — `Session` 型に `tokenHash: string` 追加、`Session.ByTokenHash(hash)` spec を追加
- `server/src/models/common/token.ts` — `Token.hash()` メソッドを追加 (sha256 を base64url で返す)
- `server/src/repositories/session/postgres/{common,upsert}.ts` — `token_hash` 列の read/write
- `server/src/usecases/auth/login.ts` — raw token を `Token.generate()` で発行 → `hash` を Session に持たせて保存 → 戻り値に `rawSessionToken` を含める
- `server/src/presentation/middleware/session.ts` (PR 4 で新設) — cookie 取得 → hash → `Session.ByTokenHash`
- `server/src/presentation/trpc/routers/auth.ts` (PR 4) — login 応答の cookie に raw token をセット
- `docs/plans/00-overview.md` のセキュリティモデル表 (sessionハイジャック + DB 漏洩 行に追記)
- `docs/plans/04-trpc-middleware-and-auth-router.md` (本 ADR に従うよう書き換え)

## 参照

- `docs/plans/00-overview.md` (セキュリティモデル / 触れる触れない表)
- `docs/plans/04-trpc-middleware-and-auth-router.md`
- ADR-0002 (サーバは Twitch の access/refresh token を保持しない) — 「DB に何を置かないか」の設計思想が共通
- 関連 specre カード: (specre 導入後に追記)
