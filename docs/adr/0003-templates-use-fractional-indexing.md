---
id: "0003"
title: "テンプレートの並び順は fractional indexing で管理する"
status: "superseded"
date: "2026-04-17"
supersedes: null
superseded_by: "0004"
related_specres: []
tags: ["db", "ux"]
---

## コンテキスト

テンプレート一覧はユーザーが D&D で自由に並び替えできる UI を提供する。DB 側でこの並び順を永続化する方法を決める必要がある。

運用想定:

- 1 ユーザーあたりのテンプレート件数は数件〜数十件
- 並び替え操作はリアルタイムで頻発する（D&D 中に複数回発生する可能性あり）
- 並び順での一覧取得は毎画面表示で発生

## 検討した選択肢

### 案A: `position` を DOUBLE PRECISION にして fractional indexing（採用）

前後の position の中間値 (`(prev + next) / 2`) を新しい行に割り当てる。

```sql
position    DOUBLE PRECISION NOT NULL,
-- インデックス
CREATE INDEX templates_user_id_position_idx ON templates(user_id, position);
```

- **メリット**
  - 並び替え 1 回あたりの UPDATE は 1 行のみ
  - 既存行を触らないのでロック競合が小さい
  - 複合インデックス `(user_id, position)` で並び順取得が高速

- **デメリット**
  - 極端に偏った挿入を繰り返すと float 精度が尽きて reindex が必要
  - position の値が人間には無意味な float になる

### 案B: `position INTEGER` + 並び替え時に全件 UPDATE

- **メリット**
  - 実装がシンプル、精度問題なし
  - position 列が人間に読みやすい（1, 2, 3, ...）

- **デメリット**
  - 1 回の並び替えで最大 N 行を UPDATE（N = ユーザーのテンプレート件数）
  - 同時並び替えでロック競合
  - テンプレート件数が増えると D&D のレスポンスが遅くなる

### 案C: 双方向リンクリスト (`prev_id` / `next_id`)

- **メリット**
  - position 列不要、挿入・削除が局所的
  - reindex 不要

- **デメリット**
  - 並び順での取得に再帰 CTE が必要で重い
  - リンク整合性破壊時のリカバリが困難

## 決定

**案A を採用する**。

D&D 操作のレスポンス性と実装複雑度のバランスが最も良い。float 精度の問題は現実的なテンプレート件数（数十件）では発生せず、発生した場合も「全件の position を等間隔に再割り当て」という単純な reindex ユースケースで解決できる。

## 帰結

- **良い帰結**
  - 並び替え API は 1 行 UPDATE だけで済む
  - 複合インデックス `(user_id, position)` で一覧取得が O(log n) + 順次スキャン
  - 並び順の partial update が client → server で自然に表現できる

- **悪い帰結**
  - 将来的に reindex ユースケースの追加が必要になる可能性
  - position 列の値が人間には無意味な float になり、デバッグ時の可読性が下がる

- **影響範囲**
  - `schema/tables/templates.sql`（`position DOUBLE PRECISION NOT NULL` + 複合インデックス）
  - template 並び替え usecase（中間値計算ロジック）
  - client 側の D&D ハンドラー（新位置の前後 position を送信）

## 参照

- `docs/plans/01-db-schema-and-env.md`
- `docs/plans/00-overview.md`（用語集: fractional indexing）
- 関連 specre カード: （specre 導入後に追記）
