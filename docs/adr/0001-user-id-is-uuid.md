---
id: "0001"
title: "ユーザー主キーは UUID、Twitch user id は UNIQUE 列"
status: "accepted"
date: "2026-04-17"
supersedes: null
superseded_by: null
related_specres: []
tags: ["db", "auth"]
---

## コンテキスト

Twitch OIDC 認証導入にあたり `users` テーブルを新設する。ユーザーを識別しうるキーは 2 つある:

- Twitch 側が払い出す `sub` (数値の文字列、Twitch 内で恒久的に一意とされる)
- アプリ内部で生成する識別子

この両者をどう扱うか——Twitch の `sub` をそのまま PK にするか、内部で UUID を生成して Twitch ID を別列で持つか——を決める必要がある。

論点は主に以下:

- 他テーブル (`sessions`, `templates`, `user_settings`) の ID 規約との型の一貫性
- 将来の認証プロバイダ追加（Google/Discord 等）への拡張余地
- Twitch 側の外部 ID が変わりうる稀ケースにおける影響範囲
- ログ・URL・エラーメッセージ等、通常運用で内部 ID が露出する経路での分離（※ DB 漏洩時は `twitch_user_id` 列も含めて漏れるので、これは DB 漏洩時の境界ではない）

## 検討した選択肢

### 案A: UUID を PK、`twitch_user_id` を UNIQUE 列（採用）

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
twitch_user_id  TEXT NOT NULL UNIQUE,
```

- **メリット**
  - 型の一貫性: `sessions.id` / `templates.id` が UUID なので users も UUID で揃う。FK 列はすべて 16 bytes 固定幅で、スキーマ / index / TypeScript の `Id` 型を単一に保てる
  - 外部 ID 変更耐性: Twitch が user_id を変える稀事象でも内部 FK (`sessions.user_id`, `templates.user_id`) は壊れず、`twitch_user_id` の 1 列更新で済む
  - 運用時の露出経路の分離: ログ・URL・エラーメッセージ等に内部 ID が現れても Twitch プロフィールへの直リンクにならない（※ DB 漏洩時は `twitch_user_id` 列も漏れるので、これは DB 漏洩時の境界にはならない）
  - テスト fixture が独立: `generateId()` だけで作れ、モック Twitch ID の衝突管理が不要

- **デメリット**
  - 列が 1 本増える（`id` と `twitch_user_id UNIQUE`）
  - login 時に `twitch_user_id → users.id` を引く 1 クエリが必要（session に user_id を載せれば以降は 0 コスト）

### 案B: `twitch_user_id` を PK

- **メリット**
  - 列が減り、id_token の `sub` をそのまま FK として使える
  - login 後の CRUD で users の lookup が省ける場合がある

- **デメリット**
  - TEXT PK の FK が拡散: `sessions.user_id` / `templates.user_id` が TEXT になり、他テーブルと型が不揃いになる（主要な不採用理由）
  - Twitch 側変更リスクの全量被弾: sub が変わると全テーブルのキー書き換え（実質不可能）
  - 運用時の露出経路で内部 ID がそのまま Twitch 公開識別子として現れる（ログ・URL・エラーメッセージ経由）

## 決定

**案A を採用する**。

主要な決め手は **他テーブル ID (`sessions.id` / `templates.id` / 全 FK 列) との型の一貫性**。すべてを UUID 16 bytes 固定幅で統一することで、スキーマ / index / ORM / TypeScript の `Id` 型を単一に保ち、FK 列幅とインデックス設計を単純化できる。

副次的に Twitch 側の外部 ID 変更リスクを `users` の 1 列に隔離できる点、運用時のログ/URL で Twitch 公開 ID が直接露出しない点も利点だが、これらは単独では PK 選択を決める根拠にならない。

案B の「シンプルさ」は `auth.login` の 1 回の upsert にしか効かず、全 FK 列を TEXT 可変長にする代償に見合わない。

**補足: 認証プロバイダ拡張については本 ADR の決定要因に含めない**。将来 Google/Discord 等を追加する場合は `twitch_users` / `youtube_users` 等のプロバイダ固有テーブルを別立てして `users.id` に外部参照させる構成を想定しており、そのような再構築が必要になる時点で案A/B いずれを選んでいても同等の移行コストがかかるため、PK 選択だけで拡張余地を確保する設計は取らない。

## 帰結

- **良い帰結**
  - sessions / templates / user_settings の FK はすべて UUID で統一され、スキーマ / index / 型定義が単純化される
  - 外部 ID 変更リスクが `users.twitch_user_id` の 1 列に閉じる
  - 内部 ID と Twitch 公開 ID が分離され、ログ・URL 等の通常運用での露出安全性が上がる（DB 漏洩時の境界ではない点に注意）

- **悪い帰結**
  - `users` テーブルに列が 1 本増える（無視できる量）
  - `auth.login` usecase 内で `twitch_user_id → users.id` の lookup が 1 クエリ必要

- **影響範囲**
  - `schema/tables/users.sql`（PK 定義）
  - `schema/tables/sessions.sql` / `templates.sql` / `user_settings.sql`（`user_id UUID REFERENCES users(id)`）
  - `auth.login` usecase の upsert ロジック

## 参照

- `docs/plans/01-db-schema-and-env.md`
- `docs/plans/00-overview.md`
- ADR-0002（サーバは Twitch access/refresh token を保持しない。別軸の判断だが関連）
- 関連 specre カード: （specre 導入後に追記）
