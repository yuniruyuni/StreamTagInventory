---
id: "0009"
title: "per-table GRANT を pgschema で declarative に管理し、DB role 本体は NixOS が source of truth"
status: "accepted"
date: "2026-04-23"
supersedes: null
superseded_by: null
related_specres: []
tags: ["db", "migration", "pgschema", "security", "infra"]
---

## コンテキスト

[ADR 0008](./0008-cloud-run-service-connects-as-dml-only-app-user.md) で Cloud Run service を app user (`stream_tag_inventory_app`) に切り替えた直後、本番で `templates.sync` が `permission denied for table template_docs (SQLSTATE 42501)` で 500 を返す事故が発生した。

原因分析:

- infra repo (`yuniruyuni.net`) の NixOS 構成は `postgresql-app-credentials` systemd oneshot で `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stream_tag_inventory_app` を発行している
- ただしこの `GRANT ... ON ALL TABLES` は **実行時点で存在する table にしか効かない** (PostgreSQL の仕様)
- `template_docs` は ADR 0007 migration (2026-04-20) で新規作成されたが、以降 `nixos-rebuild switch` が走っていなかったため oneshot が再実行されず、`template_docs` 個別には GRANT が付与されていなかった
- `ALTER DEFAULT PRIVILEGES` も同 oneshot が発行していたが、これは **設定後** に作られた table にしか適用されない (`template_docs` が先に存在していたため無効)

`systemctl start postgresql-app-credentials.service` を実行して暫定復旧したが、同じ構造で「新 table 追加 → 次の NixOS activation までの間 permission denied」が永続的に発生し続けるため、根治策が必要になった。

同時に、本 repo は pgschema を declarative schema migration に採用しているが、**`.pgschemaignore` で `[privileges]` / `[default_privileges]` を ignore** していたため、GRANT 系統は pgschema の対象外になっていた。これは過去の経緯として「pgschema の plan phase が内部 temp schema で desired state を validate するが、その scratch 環境に production の role が存在しないため `role does not exist` で fail する」という既知の制約を回避するための設定だった。

## 検討した選択肢

### 案A: 現状維持 — NixOS で `GRANT ON ALL TABLES` を撒く (却下)

- **メリット**
  - 追加の変更なし
- **デメリット**
  - 「新 table 追加 → NixOS activation 待ち」の競合状態が永続する
  - app repo の CI で schema を追加しても、infra repo の activation が別手動で走らない限り権限が付かない。構造的に壊れやすい

### 案B: `bin/migrate.sh` の末尾で psql 経由に GRANT を流す (却下)

- **メリット**
  - schema 変更と GRANT が同じ CI で着地する (タイミング問題が消える)
  - `--plan-host` を外部 DB に向ける必要がなく、既存の接続情報で完結
- **デメリット**
  - app repo 側の bash スクリプトに role 名 (`stream_tag_inventory_app`) と GRANT の全列挙をハードコードすることになり、infra repo との drift 源が生まれる
  - declarative 性を失う (bash のべた書きになる)
  - 複数 table が増えるたびに script に追記する運用負荷

### 案C: pgschema の `--plan-host` を本番 DB に向ける (却下)

`.pgschemaignore` を外し、`--plan-host` で本番 cluster 内の別 DB (`plandb`) もしくは本番 DB 自身を plan 用に使うことで、role が plan phase でも参照可能になる。

- **メリット**
  - 仕組みとしては最小変更
- **デメリット**
  - **GitHub Actions の schema-plan ワークフローから本番 cluster への接続が必要** になる。plan は PR で発火するため、攻撃面が大きく広がる。`yuniruyuni.net` repo 外の PR (dependabot / 将来の contributor) から本番 DB への経路ができるのは致命的
  - 外部 DB を立てる案 (`plandb` を本番 cluster に置かない方式) も検討したが、role を CI 環境で pre-create するための init スクリプトが別途必要になり、role 名の drift 源が再度生まれる

### 案D: app repo 側で裸の `CREATE ROLE` を宣言し、pgschema の embedded plan DB にだけ role を作らせる (採用)

pgschema の挙動を実地検証した結果、以下が確認できた:

1. pgschema の **dump scope は `--schema` で指定した schema (= public) 配下のオブジェクトに限定**される。role は cluster-level のため dump に含まれない → 同 plan から **CREATE ROLE が target DB の diff として出力されない**
2. embedded plan DB は呼び出しごとに fresh に spawn される。つまり一時的に role を `CREATE ROLE` で作っても target DB に伝播しない
3. pgschema は GRANT / REVOKE / ALTER DEFAULT PRIVILEGES を declarative に diff する機能を完備している (`.pgschemaignore` で opt-out していただけ)

したがって以下で完結する:

- `schema/tables/000_roles.sql` に `DO $$ ... IF NOT EXISTS ... CREATE ROLE ... $$` を置く (*1)
- 各 table の SQL 末尾に `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO stream_tag_inventory_app;` を書く
- `.pgschemaignore` の `[privileges]` / `[default_privileges]` セクションを削除して pgschema に管理を任せる
- infra repo 側の `postgresql-app-credentials` からは `GRANT ON ALL TABLES` / `ALTER DEFAULT PRIVILEGES` を削除 (別作業、本 ADR の follow-up)

(*1) `DO` block で冪等化する理由: `server/test/helpers/pgschema.ts` は target DB 自身を `--plan-host` に指定する (テスト高速化のため) ため、target DB (embedded-postgres) が superuser として `stream_tag_inventory` を持っている場合、裸の `CREATE ROLE` だと `role already exists` で失敗する。production migration の embedded plan DB は毎回 fresh なので裸でも動くが、テスト環境との両立のために DO block ガードを入れる。PostgreSQL は `CREATE ROLE IF NOT EXISTS` を native に sport していないため DO block は構文上必須。

- **メリット**
  - **新 table 追加 + GRANT が同じ pgschema migration でアトミックに反映される** ため、本 ADR のきっかけになった競合状態が原理的に消滅
  - plan phase は embedded plan DB のみで完結し、本番 DB へのアクセスが不要 (CI security が保てる)
  - DB role の生存管理は infra repo (NixOS) が source of truth のまま。app repo で宣言するのは「pgschema plan DB で validation を通すための role 名参照」だけで、password や認証方法は関与しない
  - `.pgschemaignore` を全消去でき、pgschema の declarative 性が最大化される
- **デメリット**
  - role 名 (`stream_tag_inventory` / `stream_tag_inventory_app`) が app repo と infra repo の両方に出現する。ただし app repo 側は「pgschema を validate させるための宣言」に限られ、password / 認証方法は infra repo のまま。drift するリスクは role 名の rename 時のみ (頻度極小)
  - pgschema の挙動に依存した設計であり、「dump scope が schema-local」「embedded plan DB が fresh」という前提が将来変わると破綻する。ただし pgschema 1.6.x 時点で公式ドキュメントに明記された仕様であり、本 ADR で検証済

## 決定

**案D を採用する**。per-table GRANT は `schema/tables/*.sql` に宣言し、pgschema の declarative diff で反映する。DB role の CREATE / ALTER / CONNECT / SCHEMA USAGE は infra repo (`yuniruyuni.net/nixos/services/postgresql.nix`) が source of truth を維持する。

### 責務分担 (ADR 0008 のマトリクスを再掲)

| 責務 | 所在 |
|---|---|
| role の存在 / password / CONNECT / SCHEMA USAGE | infra repo (NixOS) |
| per-table GRANT | **app repo (pgschema declarative)** |
| `ALTER DEFAULT PRIVILEGES` | app repo (declarative 時は不要になる見込み) |
| plan DB 用の role 宣言 | app repo (`schema/tables/000_roles.sql`) |

### なぜ `ALTER DEFAULT PRIVILEGES` を残さないのか

案D + declarative なら「新 table を追加したら必ず同じ PR で GRANT も宣言する」運用に落ちる。`ALTER DEFAULT PRIVILEGES` はあくまで「GRANT 宣言を忘れたときの safety net」であり、declarative のレビュー / plan 段階で GRANT 漏れに気付ける以上冗長。むしろ残すと「GRANT を忘れても default で通ってしまう」ケースで漏れに気付けなくなるため、**明示 GRANT のみを正とする** 方針を取る。

## 帰結

### 良い帰結

- 新 table + GRANT がアトミックに migration に載るため、`permission denied` 競合が発生しない
- `.pgschemaignore` が不要になり、pgschema の管理範囲が最大化される (将来 index / view / constraint に対する GRANT も同じ仕組みで扱える)
- plan phase は embedded plan DB のみで完結し、**CI からの本番接続が必要にならない**
- app repo と infra repo の責務境界がより明確になる (role 管理 = infra / permission 宣言 = app)

### 悪い帰結

- `schema/tables/000_roles.sql` が必要になる。純粋な schema 宣言と違って「pgschema の plan DB を通すための存在」という説明的な存在になる (コメントで意図を明記済)
- role 名の文字列が app repo にも出現し、infra repo と 2 箇所の暗黙的合意になる。rename する場合は両方の変更が必要
- pgschema の「dump scope = schema-local」「embedded plan DB は fresh」という前提に依存する。upstream の挙動変更で破綻する可能性がある (ただし `.pgschemaignore` の existence が示すように、pgschema 公式はこれらを安定仕様として提供している)
- 初回適用時に NixOS 側が先に発行していた `ALTER DEFAULT PRIVILEGES` が pgschema の REVOKE で撤去される diff が発生する。follow-up で infra 側の宣言を削除するまでは、NixOS activation / migration のたびに双方向 drift が往復する

### 影響範囲

- **app repo**:
  - `schema/tables/000_roles.sql` 新設 (DO block で role を冪等宣言)
  - `schema/tables/template_docs.sql` 末尾に per-table GRANT を追加
  - `.pgschemaignore` 削除 (および `Dockerfile.migration` の COPY 行を削除)
  - `CLAUDE.md` に「pgschema の declarative GRANT と role 宣言」節を追加
  - `.github/workflows/schema-plan.yml` の baseline apply に `--auto-approve` を追加 (初めて main に schema があり且つ PR が schema を変える状況で顕在化したバグ)
- **infra repo (`yuniruyuni.net`)** — follow-up として:
  - `nixos/services/postgresql.nix` から `GRANT ... ON ALL TABLES IN SCHEMA public` / `GRANT ... ON ALL SEQUENCES IN SCHEMA public` / `ALTER DEFAULT PRIVILEGES ... TABLES` / 同 SEQUENCES を削除
  - `CREATE USER` / `ALTER USER ... PASSWORD` / `GRANT CONNECT ON DATABASE` / `GRANT USAGE ON SCHEMA public` は残す (pgschema の dump scope 外 / cluster level の責務)

## 参照

- ADR-0007 (stateless JWT Bearer — schema 最小化により本 ADR の per-table GRANT コストが現実的になった)
- ADR-0008 (Cloud Run service の least privilege 採用 — 本 ADR のきっかけになった permission denied 事故の前提)
- `CLAUDE.md` 「pgschema の declarative GRANT と role 宣言」節 — 実装者向け運用ガイド
- pgschema 公式: `--plan-host` / `--plan-db` フラグと `.pgschemaignore` の `[privileges]` / `[default_privileges]` セクション仕様 (1.6.x 時点)
