---
id: "0004"
title: "テンプレートデータは Yjs による local-first 同期で管理する"
status: "accepted"
date: "2026-04-17"
supersedes: null
superseded_by: null
related_specres: []
tags: ["data-sync", "crdt", "db", "security"]
---

## コンテキスト

テンプレート (Twitch 配信タイトル / カテゴリ / タグのセット) をサーバで永続化するにあたり、以下を満たす必要がある:

- **複数端末で編集**: 配信 PC・サブ PC・スマホなどから同じテンプレート集合を操作したい
- **オフライン耐性**: 既存実装が localStorage 前提で、オフラインでも編集できた UX を壊さない
- **並行編集の安全性**: 複数タブ / 複数端末で同時操作しても、編集がサイレントに失われない
- **並び替え UI の即応性**: D&D 操作 1 回で大規模 UPDATE を走らせない
- **既存のクリーンアーキ規約と両立**: `docs/architecture.md` の Repository 標準メソッド / Spec パターンを維持
- **認証は変更しない**: サーバ側で id_token / session cookie を検証する既存設計 (ADR 0002 参照) はそのまま使う

初期案では fractional indexing (ADR 0003) を採用した通常の行単位リレーショナル設計を予定していた。しかし設計レビューで以下が問題となった:

- **`position DOUBLE PRECISION` の攻撃面**: `NaN` / `±Infinity` / 極端な値 / 精度枯渇 (bisection exhaustion) などクライアントから float を送らせる API は攻撃面が広い
- **並行編集の損失**: 同じ行を 2 デバイスが同時に編集すると last-write-wins でサイレントに片方が消える
- **オフライン編集のキューイング**: localStorage → サーバ同期の復旧ロジックを独自実装すると複雑度が高い
- **並び替えと編集が別 API**: reorder / upsert / delete / bulkUpsert と手続きが増え、マルチデバイス競合の境界条件が増える

これらは CRDT (Conflict-free Replicated Data Type) を採用することで構造的に解消できる。

## 検討した選択肢

### 案A: Yjs による CRDT 同期（採用）

テンプレートデータを 1 ユーザー 1 Y.Doc にまとめて、`Y.Array<Y.Map>` として表現する。DB はこの Y.Doc のバイナリ状態 (BYTEA) を保持するだけ。クライアントは `y-indexeddb` でローカル永続化し、tRPC 経由で state vector を交換して双方向マージする。

**データ構造** (Y.Doc 内部):
- `doc.getArray('templates')`: `Y.Array<Y.Map>` — テンプレートの並び順を Y.Array が保持 (position 列不要)
- `doc.getMap('settings')`: `Y.Map` — postTemplate などユーザー設定
- 各 template の Y.Map: `{ id, title, categoryId, categoryName, categoryBoxArtUrl, tags: Y.Array<string> }`

**同期プロトコル** (REST / tRPC):
- `templates.sync({ clientStateVector, clientUpdate? })` → `{ serverUpdate, serverStateVector }`
- クライアントは自分の SV を送り、サーバは差分 update を返す
- クライアントが書き込み分を含めた update を送ると、サーバはトランザクション内で `FOR UPDATE` を取って適用 → スナップショット書き戻し

**認証境界**:
- sync endpoint は既存の `protectedProcedure` (session cookie 検証必須) に乗せる
- サーバは `ctx.user.id` のみを信用し、クライアントから `user_id` を受け取らない
- 1 ユーザー 1 Y.Doc 原則で、他ユーザーの doc へは構造上アクセス不能

- **メリット**
  - **並行編集が設計上安全**: CRDT の収束性で、複数デバイス同時編集が自動マージされる
  - **並び替えは Y.Array 任せ**: position 列 / fractional indexing / reorder API が丸ごと不要。float 攻撃面がゼロに
  - **オフライン対応が標準**: `y-indexeddb` がローカル永続化、オンライン復帰で自動 sync
  - **複数タブ同期も自動**: `y-indexeddb` の BroadcastChannel で同一ブラウザの別タブが同期
  - **API が縮小**: `list/upsert/delete/reorder/bulkUpsert` 5 本 + `getPostTemplate/setPostTemplate` 2 本 → `templates.sync` 1 本に
  - **既存 Repository 規約と両立**: spec = `{ userId }` 1 種類のみだが、標準メソッド `get` / `upsert` / `delete` にそのまま乗る

- **デメリット**
  - **サーバ側で中身をクエリできない**: 「全ユーザーのタグ集計」等の横断分析は Y.Doc のバイナリから取り出せない (現状要件には無いが将来制約)
  - **pgschema diff で中身のスキーマ変更が見えない**: カラム単位のレビューが効かず、Y.Doc の shape 変更はアプリコード内のみで管理
  - **shape validation をアプリで書く必要**: `applyUpdate` 後に Y.Doc の構造を検証しないと、悪意のある update でデータ構造を汚染される
  - **バンドルサイズ増**: Yjs + y-indexeddb でおよそ 40-50KB (gzip 後 10-15KB 程度)
  - **CRDT 特有の学習コスト**: 新規コントリビュータに概念説明が要る

### 案B: 行ごと LWW + HLC

テンプレートごとに Hybrid Logical Clock を持たせ、`deleted_at` tombstone で削除を表現、サーバは `WHERE hlc > stored.hlc` で merge する設計。

- **メリット**
  - 普通のリレーショナルスキーマに近く、pgschema レビューが効く
  - 横断クエリ (タグ集計等) が可能
  - Yjs の学習コスト不要

- **デメリット**
  - **同一行の同時編集で片方ロスト**: 行単位 LWW なので、title を Tab1 で / tags を Tab2 で編集すると片方が消える
  - **並び替えは別途 fractional indexing (文字列 or float) が必要**: 攻撃面・精度問題が残る
  - **自作の sync/merge ロジックが必要**: tombstone GC、HLC のクランプ、CSRF 対策の push/pull endpoint を自前で組む
  - 案A と比べて「構造的に安全」と言えるレベルに達するのに実装量が多い

### 案C: リレーショナル CRUD のみ (初期案、ADR 0003 路線)

`templates` テーブル + `position DOUBLE PRECISION` + `list/upsert/delete/reorder/bulkUpsert` API。

- **メリット**
  - 最もシンプル、既存の tRPC + Repository パターンに素直
  - サーバ側検索・集計が完全に可能

- **デメリット**
  - **並行編集保護なし**: last-write-wins でサイレントロスト
  - **position の攻撃面**: NaN/Inf、精度枯渇、重複値、極端値。Zod 検証 + reorder を命令型 API にする等の対策で緩和できるが、攻撃面は残る
  - **オフライン編集キューの自作**: localStorage との同期復旧ロジックが複雑
  - **マルチデバイス UX が脆い**: 別端末の変更を知る手段は手動 refetch のみ

## 決定

**案A (Yjs) を採用する**。

判断の核は以下 3 点:

1. **攻撃面の構造的排除**: position 周りの float 攻撃ベクタ (NaN / Inf / 精度枯渇 / 重複) がクライアント API から消える。Zod バリデーションで塞ぎ込む必要もない
2. **マルチデバイス / 並行編集の体験**: 配信用 PC と別端末を併用するユーザー体験で「サイレントにデータが消える」事故を構造的に防げる
3. **コードベースの縮小**: 5 CRUD エンドポイント + 並び替えロジック + オフライン復旧 → `sync` 1 本 + Y.Doc 定義、に置き換わる

ADR 0003 (fractional indexing) は position 列ごと不要になるため、本 ADR により **supersede する**。

## 帰結

### 良い帰結
- テンプレート並び替え API が消滅 (`reorder` / `bulkUpsert` も)、`templates.sync` 1 本に集約
- オフライン編集が `y-indexeddb` で自然に動く、再接続時の自動同期
- 複数タブ / 複数デバイスの編集が merge される (損失なし)
- position 関連のセキュリティ懸念 (float 攻撃) が消える
- サーバ側 usecase / repository のコード量が減る

### 悪い帰結
- サーバ側で Y.Doc の中身をクエリできない → 将来「ユーザー横断でタグ人気集計」等が必要になったら Y.Doc 展開 / 別テーブル派生が必要
- pgschema レビューで Y.Doc shape 変更を検知できない → shape validation テストでカバーする必要
- Yjs バンドルサイズが client に追加 (gzip 後 ~15KB)
- 悪意ある update による Y.Doc 汚染を防ぐため、サーバ側で shape / サイズ検証を実装必須
- Cloud Run の cold start 時に Y.Doc の復元コストが毎回発生 (小規模な Y.Doc なら無視できる)

### 受容するリスクと根拠
- **shape validation の実装責任**: Yjs の applyUpdate は任意構造を作れる。想定トップレベルキー / 型 / サイズを超えた Y.Doc はトランザクションごと reject する方針を取る。実装詳細は `docs/plans/05-*.md` 参照
- **同行同時編集のフィールド単位マージは今回範囲外**: title / postTemplate など短文字列は `Y.Map` の string フィールドで保持し、行単位 LWW 相当の挙動。文字単位のマージが必要な場面が出たら該当フィールドのみ `Y.Text` 化する段階移行を許容

### 影響範囲

- `schema/tables/templates.sql` / `schema/tables/user_settings.sql` を **削除**し、`schema/tables/template_docs.sql` に置き換える
- `server/src/models/template/` の entity 定義は Y.Map の shape 定義にシフト、`server/src/models/userSettings/` は削除 (Y.Doc 内 `settings` に統合)
- `server/src/repositories/template/` → `server/src/repositories/templateDoc/` に変更、spec は `{ userId }` のみ、標準メソッドは `get` / `upsert` / `delete` を実装 (`list` / `count` は単一行エンティティで不要なため省略)
- `server/src/usecases/template/` の `list/upsert/bulkUpsert/delete/reorder` を廃止、`sync` に一本化
- `server/src/usecases/userSettings/` を削除 (sync に吸収)
- `server/src/presentation/trpc/routers/templates.ts` は `sync` 単一の procedure に
- `client/src/hooks/` に Y.Doc + y-indexeddb を束ねる `useTemplateDoc` を新設
- 既存 `useStorage<Template[]>("templates")` 依存コードは Y.Doc 参照に置き換え
- 既存 localStorage データからの移行は Y.Doc 初期化時に 1 回だけ取り込む初期化処理で対応

## 参照

- `docs/adr/0003-templates-use-fractional-indexing.md`（本 ADR により superseded）
- `docs/adr/0002-server-does-not-hold-twitch-tokens.md`（認証設計との境界）
- `docs/plans/00-overview.md`（シリーズ全体のオーバービュー）
- `docs/plans/01-db-schema-and-env.md`（`template_docs` テーブル定義）
- `docs/plans/05-template-and-user-settings-router.md`（sync usecase / router の設計）
- `docs/plans/07-template-trpc-and-migration-ui.md`（Y.Doc 利用フロント実装）
- Yjs: https://github.com/yjs/yjs
- y-indexeddb: https://github.com/yjs/y-indexeddb
- 関連 specre カード: （specre 導入後に追記）
