---
id: "0002"
title: "サーバは Twitch の access/refresh token を保持しない"
status: "accepted"
date: "2026-04-17"
supersedes: null
superseded_by: null
related_specres: []
tags: ["auth", "security"]
---

## コンテキスト

StreamTagInventory は Twitch 配信者向けのカテゴリ・タグ管理ツールで、Twitch API (`/helix/*`) をユーザーに代わって呼び出す。

認証方式として以下の 2 方針が考えられる:

- サーバ側で OAuth Authorization Code Flow を完遂し、access/refresh token を DB に保管 → API 呼出もサーバ経由
- OIDC Implicit Hybrid Flow で client が access_token を直接受け取り、id_token だけをサーバへ送る → API 呼出は client 直接

現状は client が Implicit Flow で access_token を sessionStorage に保管しており、そのまま `client/src/api/twitch.ts` 経由で Twitch API を直接呼んでいる。サーバは空。

この状態で "サーバでユーザーを識別してテンプレート DB を提供" するにはサーバ側の identity 確立が必要。ここで access/refresh token を DB に持つか否かを決める。

## 検討した選択肢

### 案A: サーバは Twitch トークンに触れず、id_token のみで identity 確立（採用）

OIDC Implicit Hybrid Flow (`response_type=token id_token`) を用いる。

- **access_token**: 従来通り client の sessionStorage に保管、Twitch API 直接呼出に使用
- **id_token**: サーバへ POST → JWKS 検証 → identity 確立 → HttpOnly Cookie でサーバセッション発行
- サーバは Twitch access/refresh token を **見ない・保持しない・転送しない**

詳細は `docs/plans/00-overview.md` の「採用フロー」および「触れる/触れないもの」表を参照。

- **メリット**
  - サーバ DB が漏洩しても Twitch アカウントは無傷（Twitch トークンが 1 つも DB に無い）
  - 既存の Twitch API 呼出コードを一切変更しなくて良い
  - refresh token 管理（失効・ローテーション・暗号化保管）の複雑度が丸ごと不要
  - サーバ側の責務を "identity 確認 + アプリ固有データ CRUD" に限定できる

- **デメリット**
  - Implicit Flow 特有のリスク（XSS による access_token 窃取）は現状と同水準のまま残る
  - サーバからの Twitch API 呼出（webhook・バッチ・通知）は実装できない

### 案B: サーバが Authorization Code Flow で access/refresh token を取得し DB 保管

- **メリット**
  - サーバからの Twitch API 呼出が可能（将来の webhook 等に対応）
  - access_token が client から見えず XSS 耐性が上がる

- **デメリット**
  - トークン保管の複雑度: 暗号化、ローテーション、失効処理、KMS 連携
  - サーバ DB 漏洩時の blast radius が Twitch アカウントまで拡大
  - 既存の client 側 API 呼出コードを全てサーバ proxy 経由に書き直す必要あり
  - ドメイン乗っ取り時の被害が拡大

## 決定

**案A を採用する**。

本アプリの現状機能（テンプレートの保存と Twitch API の薄い wrapper）では **サーバからの Twitch API 呼出は不要**。一方で Twitch トークンを DB に持つと、DB 漏洩時に Twitch アカウントへ連鎖するという重い責任を負う。サーバの役割を "identity 確認 + アプリ固有データ CRUD" に限定することで、セキュリティと実装複雑度を両取りする。

## 帰結

- **良い帰結**
  - `oauth_tokens` / `oauth_states` テーブルを作らない（schema の簡素化）
  - サーバ DB 漏洩の blast radius はアプリ固有データ（テンプレート等）に限定
  - refresh token のローテーション / 失効 / 暗号化保管コードが不要

- **悪い帰結**
  - 将来 "サーバからの定期的な Twitch API 呼出"（webhook / 通知バッチ等）が必要になった場合、本 ADR を supersede する必要あり
  - Implicit Flow の access_token XSS リスクは現状維持（緩和は将来的な課題）

- **影響範囲**
  - `schema/tables/` — `oauth_tokens` / `oauth_states` テーブルなし
  - `server/src/` — Twitch API 呼出コードなし、jose による id_token 検証のみ
  - `client/src/api/twitch.ts` — 無変更のまま継続

## 参照

- `docs/plans/00-overview.md`（採用フロー: OIDC Implicit Hybrid Flow、セキュリティモデル表）
- `docs/plans/03-twitch-jwks-and-auth-usecases.md`
- ADR-0001（ユーザー主キーは UUID）
- 関連 specre カード: （specre 導入後に追記）
