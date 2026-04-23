---
id: "0008"
title: "Cloud Run service は DML-only の app user で DB 接続する (least privilege)"
status: "accepted"
date: "2026-04-23"
supersedes: null
superseded_by: null
related_specres: []
tags: ["security", "db", "cloud-run", "least-privilege"]
---

## コンテキスト

[ADR 0007](./0007-stateless-jwt-bearer-no-server-session.md) 以降、本ツールの DB 操作は `template_docs` 表への per-user Y.Doc upsert / select のみに縮退した。しかし Cloud Run service と pgschema migration job は同一 secret (`stream-tag-inventory-db-password`) 経由で **両方とも owner role (`stream_tag_inventory`)** を使用しており、service が DDL 権限を持ったまま稼働している状態だった。

infra repo (`yuniruyuni.net`) の NixOS 構成では既に app user (`stream_tag_inventory_app`) が宣言的に作成され、GCP Secret Manager にも対応する secret (`stream-tag-inventory-db-app-password`) が存在していた。にも関わらず app user への切替が行われていなかった経緯として:

1. 初期セットアップ時点では DB 側に app user が未作成だった (NixOS 構成に追記する前の時期)
2. その状態で deploy すると owner pw でしか起動できず、app secret を指すと `password authentication failed` で service が落ちていた
3. NixOS 側で app user を作成した後も、app repo 側の `cloudrun.yaml` は owner を向いたままになっていた (CLAUDE.md に TODO として記録のみ)

ADR 0007 で schema が最小化され、**service が必要とする操作は `SELECT / INSERT / UPDATE` のみ** (DELETE も当面不要、将来テンプレート完全削除時のため GRANT しておく) という状態が明確になったため、least privilege を実現する条件が揃った。

## 検討した選択肢

### 案A: owner を service でも使い続ける (却下)

- **メリット**
  - secret が 1 つで済む、cloudrun.yaml の変更不要
- **デメリット**
  - service プロセスが DDL 権限を持ったまま動く。万一 app 側の tRPC handler に SQL injection / raw query 漏洩 / deserialization RCE 等が入り込むと、テーブル DROP や schema 改ざんまで到達しうる
  - incident 時の blast radius が不必要に広い

### 案B: service は app user (DML のみ) / migration job は owner (DDL 必要) に分離 (採用)

- **メリット**
  - service のプロセス権限が最小化される。万一侵害されても `template_docs` 行の read / write / delete までで DDL は届かない
  - migration job と service が異なる secret を使うことで「どの経路でどの権限が発動しているか」が env から即座に読める (`cloudrun.yaml` vs `cloudrun-job.yaml`)
  - ADR 0007 でロールの責務が明確になった副産物として、ほぼゼロコストで実現できる
- **デメリット**
  - 管理する secret が 2 つになる
  - secret rotate 時に両方を同期させる手順が要る (CLAUDE.md「DB パスワード rotate 時の手順」に明記)
  - 新しい table を追加した際に app user へ GRANT する手順を忘れると permission denied になる (→ [ADR 0009](./0009-declarative-per-table-grant-via-pgschema.md) で declarative 化して解消)

### 案C: service 用に read-only user と read-write user をさらに分離 (却下)

- **メリット**
  - GET 系経路の権限がさらに絞れる
- **デメリット**
  - 本ツールの全 tRPC mutation / query が同じ pool (PgDatabase) を共有している構造なので、読み書きを別 user に分けるには infra の pool 分割が必要
  - 単一ユーザー向けツールで取引量が少なく、コストに対するリターンが薄い

## 決定

**案B を採用する**。`cloudrun.yaml` の service container は `stream_tag_inventory_app` + `stream-tag-inventory-db-app-password` で接続し、`cloudrun-job.yaml` の migration job は引き続き `stream_tag_inventory` + `stream-tag-inventory-db-password` で接続する。

DB role 自体の CREATE USER / ALTER USER PASSWORD / CONNECT / SCHEMA USAGE は infra repo (`yuniruyuni.net/nixos/services/postgresql.nix`) が宣言的に管理する。app repo の責務は「どの secret / どの DB_USER を使うか」の指定のみ。

### 分担マトリクス

| 責務 | 所在 |
|---|---|
| owner role の存在 / password | infra repo (NixOS age secret → ALTER USER) |
| app user role の存在 / password | 同上 |
| GCP Secret Manager の secret 本体 | infra repo (`gcp.tf` で `google_secret_manager_secret` 宣言) |
| Secret 値の投入 / 同期 | 手動運用 (age secret と同値を put) |
| service が参照する secret 名 / DB_USER | **app repo (`cloudrun.yaml`)** |
| migration job が参照する secret 名 / DB_USER | **app repo (`cloudrun-job.yaml`)** |
| per-table GRANT | **app repo (pgschema declarative / [ADR 0009](./0009-declarative-per-table-grant-via-pgschema.md))** |

## 帰結

### 良い帰結

- service プロセスが侵害された場合でも DDL 不可 / 他 table 作成不可 / 他 schema 参照不可に留まる
- `cloudrun.yaml` / `cloudrun-job.yaml` 2 ファイルの対比で「どの権限を持って動いているか」が明示的にレビューできる
- 将来 read-only API を追加する場合の拡張点が開く (さらに細分化した user を追加できる)

### 悪い帰結

- GCP Secret Manager 上に同期要件のある secret が 2 つ存在する。値がズレると service 起動時の `SELECT 1` で `password authentication failed` になる (`CLAUDE.md` の rotate 手順を参照)
- infra repo と app repo で「role 名」という文字列が重複する。rename 時に両方を変える必要がある (ただし rename する動機はほぼ無い)

### 影響範囲

- **app repo**:
  - `cloudrun.yaml` — `DB_USER=stream_tag_inventory_app`, `DB_PASSWORD` secretKeyRef を `stream-tag-inventory-db-app-password` に変更
  - `cloudrun-job.yaml` — 変更なし (owner を維持)
  - `CLAUDE.md` の「DB パスワードの使い分け」を least privilege 採用後の構成に書き換え、rotate 手順を追記
  - `README.md` の「app user パスワード」説明を現状化
- **infra repo (`yuniruyuni.net`)**: 本 ADR は既存の NixOS 構成を前提にしており、infra 側の変更は不要 (既に app user / secret は存在する)

## インシデント / 注意点

### 初回 deploy 時の permission denied

本 ADR を適用した PR 直後、`templates.sync` mutation が `permission denied for table template_docs (SQLSTATE 42501)` で 500 を返した。原因は NixOS 側の `postgresql-app-credentials` oneshot が「活性化時点で存在する table に `GRANT ... ON ALL TABLES` を発行する」設計のため、`template_docs` が ADR 0007 で追加された後に oneshot が再実行されていなかったため app user へ GRANT されていなかった。

暫定対処として infra ホストで `systemctl start postgresql-app-credentials.service` を実行して復旧。構造的な解消は [ADR 0009](./0009-declarative-per-table-grant-via-pgschema.md) で対応する。

## 参照

- ADR-0002 (Twitch トークンを DB に持たない — DB 漏洩時の blast radius を小さくする方向性を本 ADR も継承)
- ADR-0007 (stateless JWT Bearer — schema 最小化により本 ADR の least privilege が実用的になった)
- ADR-0009 (pgschema declarative GRANT — 本 ADR の運用課題を declarative に解消)
