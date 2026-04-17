# ADR (Architecture Decision Records)

プロジェクトの横断的な設計判断を記録する場所。**なぜその選択をしたか** を時系列で保存するのが目的。

## 一覧

| # | Title | Status | Date |
|---|---|---|---|
| [0001](./0001-user-id-is-uuid.md) | ユーザー主キーは UUID、Twitch user id は UNIQUE 列 | accepted | 2026-04-17 |
| [0002](./0002-server-does-not-hold-twitch-tokens.md) | サーバは Twitch の access/refresh token を保持しない | accepted | 2026-04-17 |
| [0003](./0003-templates-use-fractional-indexing.md) | テンプレートの並び順は fractional indexing で管理する | superseded → 0004 | 2026-04-17 |
| [0004](./0004-local-first-sync-with-yjs.md) | テンプレートデータは Yjs による local-first 同期で管理する | accepted | 2026-04-17 |

## ADR に書くこと / 書かないこと

### 書く（以下のいずれかを満たす）

1. **複数の妥当な選択肢があり、片方を選んだ**
2. **将来の作業を制約する取り決め**
3. **後で「なぜこうなってる？」と聞かれたら 30 分以上説明が要る**

### 書かない

- コードを読めば分かること → コメント or 何も書かない
- 規約・パターン → [`docs/architecture.md`](../architecture.md)
- 作業の段取り → [`docs/plans/`](../plans/)
- 振る舞いの仕様 → `docs/specres/`（specre 導入後）

## ファイル命名

- `NNNN-english-kebab-slug.md`（`NNNN` は 4 桁ゼロパディング連番、0001 から）
- タイトル本文は日本語可、slug は英語
- 例: `0001-user-id-is-uuid.md`

## ステータス

| status | 意味 |
|---|---|
| `proposed` | 検討中。実装着手前の設計スパイクでのみ使う。通常は省略 |
| `accepted` | 有効。merge 時点でデフォルト |
| `deprecated` | 有効だが非推奨。代替なしで縮退させる場合 |
| `superseded` | 後続 ADR に置き換えられた |

## 変更のルール

- **既存 ADR の本文は書き換えない**（誤字修正を除く）。ADR はその時点での判断の記録で、後から書き換えると歴史が消える
- 判断を覆すときは **新 ADR を書く**。旧 ADR の front-matter `status` を `superseded` に、`superseded_by` に新 ADR 番号を追記する（この "ポインタの追加" は例外的に許可）
- タグや `related_specres` の追記は適宜 OK

## 作成フロー

1. [`template.md`](./template.md) をコピーして次番号を振る
2. セクションを埋める
3. 本 README の一覧表に 1 行追加
4. 関連する [`docs/plans/`](../plans/) / [`docs/architecture.md`](../architecture.md) からリンクを張る
5. PR に同梱して merge → `accepted` 確定

## specre との関係

- ADR の front-matter `related_specres` に関連する specre カード ULID を列挙
- specre カード本文の "Design Intent" には `ADR-NNNN` と書いて相互参照
- ADR は横断的・永続的な判断、specre カードは個別の振る舞いに対応する契約
