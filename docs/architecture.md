# Architecture

server 側のクリーンアーキテクチャ規約。**Repository / Usecase を新規追加する前に必ず本ドキュメントを読むこと**。

派生プロジェクトは原則本ドキュメントに従い、プロジェクト固有の事情があれば各プロジェクトの `docs/architecture.md` で本ファイルを上書き / 拡張する。

---

## レイヤー構成

```
┌─────────────────────────────────────────────────┐
│ Presentation (受動的: 外部からのリクエスト受信)    │
│   tRPC routers / Hono middleware                 │
├─────────────────────────────────────────────────┤
│ Usecase (オーケストレーション)                     │
│   pre→read→process→write→post→result の 6 phase   │
│   1 usecase = 1 transaction                      │
├─────────────────────────────────────────────────┤
│ Repository (能動的: 外部システム呼出)              │
│   DB / 外部 API / コマンド実行                    │
│   標準メソッド: get / list / count / upsert / delete │
├─────────────────────────────────────────────────┤
│ Model (純粋データ + ビジネスルール、I/O なし)       │
│   Entity 型 + Spec + SortKey + factory + helper   │
└─────────────────────────────────────────────────┘
```

**依存方向**: 上位は下位を呼ぶ。Model は誰にも依存しない。**全レイヤー間のデータ受け渡しは Model 型で行う** — Presentation/Usecase/Repository が独自の DTO を定義してはならない。

### Import パスの規約

同一ワークスペース内では以下のルールに統一する:

- **レイヤーをまたぐ参照** (2 階層以上上がる import) は **必ず path alias** を使う:
  - 例: `"@/models/user"`、`"@/repositories/common"`、`"@/infra/db/sql"`
  - `"../../../models/user"` のような `../` の連続は書かない (可読性・リファクタ耐性)
- **同一パッケージ内の兄弟 / 子要素** (1 階層の `./` / `../`) は **相対パス** のまま:
  - 例: `"./postgres"` (child)、`"../repository"` (entity 内の sibling)、`"./common"`
- **test helpers** のように src 外から src を参照する場合も alias 経由:
  - 例: `"@test/factories"` (server/test/ から) → server/src/ への参照は `"@/..."` / server/test/ 内への参照は `"@test/..."`

各ワークスペースの `tsconfig.json` で `paths` を宣言する:

```jsonc
// server/tsconfig.json (例)
"paths": {
  "@/*":     ["./src/*"],
  "@test/*": ["./test/*"]
}
// client/tsconfig.json は歴史的に "~/*" → "./src/*" を使用。新規追加時は既存の prefix に従う
```

### Integration test DB 基盤

Repository の integration test は `server/test/helpers/db.ts` の `createTestDB()` 経由で embedded-postgres インスタンスに繋ぐ。schema 適用は **本番 migration と同じ `pgschema` バイナリ** を呼び出す (`server/test/helpers/pgschema.ts` が初回に GitHub リリースからダウンロード → `~/.stream-tag-inventory/bin/pgschema` にキャッシュ)。

自作の `\i tables/` 展開パーサなどは使わない。理由:

- 本番の declarative diff / shadow schema / FK 順序解決を再現できる
- 独自 SQL 実行ロジック由来のテスト失敗と、schema / Repository 側の失敗を切り分けやすい
- schema 変更で本番 pgschema apply が失敗するケースがテストで早期検知できる

pgschema のバージョンは test 側で明示 pin (`PGSCHEMA_VERSION` 定数) し、`Dockerfile.migration` との乖離は CI で検知する方針。

### Architecture testing (dependency-cruiser)

依存方向・パッケージ利用ルールは **自動検証する**。`bun run check:arch` で以下を検査:

1. **レイヤー依存方向**: Model は他に依存しない / Repository は上位に依存しない / Usecase は Repository/Presentation を直接 import しない / Presentation は Repository を直接 import しない / 循環依存禁止
2. **test-only 依存**: `embedded-postgres` のような test 専用パッケージは `src/**/*.test.ts` からのみ参照可 (production src は禁止)
3. **Usecase 間の横串禁止**: `usecases/<feature>/*.ts` が別 feature を直接 import しない (barrel index のみ許可)

ルール定義: [`server/.dependency-cruiser.cjs`](../server/.dependency-cruiser.cjs)

新しい test-only dependency を追加する場合は `.dependency-cruiser.cjs` の `embedded-postgres-only-in-test` ルールを参考に同様の制約を追加する。新しいレイヤーを追加する場合も同ファイルで依存方向を明示する。

---

## Repository 層

### 標準メソッド (固定)

DB アクセス Repository は以下 5 メソッドのみを公開する。**新しいクエリ条件を増やすために `findByXxx` / `listByXxx` を生やしてはならない**:

```typescript
export interface XxxRepository {
  get(ctx: DbReadCtx, spec: Comp<Xxx.Spec>): Promise<Xxx | null>;
  list(ctx: DbReadCtx, spec: Comp<Xxx.Spec>, cursor: Cursor<Xxx.SortKey>): Promise<Page<Xxx>>;
  count(ctx: DbReadCtx, spec: Comp<Xxx.Spec>): Promise<number>;
  upsert(ctx: DbWriteCtx, model: Xxx): Promise<void>;
  delete(ctx: DbWriteCtx, spec: Comp<Xxx.Spec>): Promise<number>;
}
```

- `Xxx.Spec` は leaf discriminated union (`{ type, ...data }` の直和)
- Repository interface の `spec` 引数は **必ず `Comp<Xxx.Spec>` で明示**。これにより「leaf と合成の違い」を型名で隠さない

- メソッド第 1 引数は **必ず capability marker** (`DbReadCtx` / `DbWriteCtx` / `ServiceCtx`)。`bindCtx` Proxy が自動注入する
- `upsert` は INSERT or UPDATE をひとつにまとめる。Model 全体を受け取る (差分 update を作らない)
- `delete` の戻り値は影響行数 (削除確認・テスト容易性のため)
- 外部システム Repository (Git / Executor 等) は標準メソッドに従わなくてもよい。DB 系のみの規約

### NG 例 / OK 例

```typescript
// ❌ NG: ByXxx メソッドの増殖
interface UserRepository {
  findById(ctx: DbReadCtx, id: string): Promise<User | null>;
  findByEmail(ctx: DbReadCtx, email: string): Promise<User | null>;
  findByName(ctx: DbReadCtx, name: string): Promise<User | null>;
  // ... 条件が増える度にメソッドが増える
}

// ✅ OK: 標準メソッド + spec
interface UserRepository {
  get(ctx: DbReadCtx, spec: Comp<User.Spec>): Promise<User | null>;
  list(ctx: DbReadCtx, spec: Comp<User.Spec>, cursor: Cursor<User.SortKey>): Promise<Page<User>>;
  // ...
}
// 呼出側
const u1 = await repos.user.get(ctx, User.ById("..."));
const u2 = await repos.user.get(ctx, User.ByEmail("..."));
const u3 = await repos.user.get(ctx, User.ByName("..."));
```

「条件を増やしたい」と感じたら **モデル側の `defineSpecs` に 1 行追加するだけ**。Repository インターフェースは無変更。

### Postgres 実装の構成

```
server/src/repositories/<entity>/
├── repository.ts          # interface 定義 (上記 5 メソッド)
├── index.ts               # re-export
└── postgres/
    ├── index.ts           # class XxxRepository implements IXxxRepository
    ├── common.ts          # XxxRow 型 / xxxSpecToSQL / rowToXxx / columnName
    ├── get.ts
    ├── list.ts
    ├── count.ts
    ├── upsert.ts
    ├── delete.ts
    └── index.test.ts
```

`common.ts` の責務:
- `XxxRow` (DB 行型) の定義
- `xxxSpecToSQL(spec): SQLFragment` — spec data を SQL WHERE 句に変換
- `rowToXxx(row): Xxx` — DB 行を Model 型に変換
- `columnName(key: Xxx.SortKey): string` — sortKey → DB カラム名マッピング

各メソッド (`get.ts` 等) は引数に `db: Database` を受け取る純関数。`postgres/index.ts` の class が `ctx.db` を取り出して各関数に委譲する:

```typescript
// repositories/<entity>/postgres/index.ts
export class XxxRepository implements IXxxRepository {
  async get(ctx: DbReadCtx, spec: Xxx.Spec): Promise<Xxx | null> {
    return get(ctx.db, spec);
  }
  // ...
}
```

### Capability marker

`server/src/repositories/common/capability.ts` で定義済の 3 種:

- `DbReadCtx`: 読み取り専用。`SELECT` 系のメソッドが取る
- `DbWriteCtx`: 書き込み可能 (`DbReadCtx` を拡張)。`INSERT` / `UPDATE` / `DELETE` 系
- `ServiceCtx`: 外部 API 呼出など、トランザクション外の副作用

`bindCtx` Proxy がメソッド呼出時に第 1 引数を自動注入する。Usecase からは `ctx.repos.user.get(User.ById(id))` の形で呼ぶ (capability の手動注入は不要)。

---

## Spec 規約 (Specification Pattern)

### モデル側の定義

```typescript
// server/src/models/<entity>/index.ts
import { defineSpecs, type Comp, type SpecsOf } from "../common";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export namespace User {
  export type SortKey = "createdAt" | "updatedAt" | "id";

  const _specs = defineSpecs({
    ById: (id: string) => ({ id }),
    ByEmail: (email: string) => ({ email }),
    ByIds: (...ids: string[]) => ({ ids }),
  });
  export const ById = _specs.ById;
  export const ByEmail = _specs.ByEmail;
  export const ByIds = _specs.ByIds;

  /**
   * Spec のデータ形状 (leaf discriminated union)。
   * 合成可能な形が必要な呼出側は `Comp<User.Spec>` と明示する。
   */
  export type Spec = SpecsOf<typeof _specs>;

  export function cursor(user: User, keys: readonly SortKey[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = user[key];
      result[key] = value instanceof Date ? value.toISOString() : String(value);
    }
    return result;
  }
}
```

ポイント:
- `interface User` (entity 型) と `namespace User` (spec / sortKey / factory / helper) を **同名で並置**
- `defineSpecs` のキー名 (`ById`, `ByEmail`, `ByIds`) がそのまま spec の type 識別子になる
- **`User.Spec` は leaf discriminated union** (`SpecsOf<typeof _specs>`)。Repository の interface / 各 get/list/count/delete の signature では `Comp<User.Spec>` で明示的に合成形を要求する。「ラップの有無を型名で隠さない」方針
- `cursor` 関数で任意の sortKey 配列から cursor 値を生成

### 合成

```typescript
// 単純条件
repos.user.get(ctx, User.ById("u1"));

// AND 合成 (メソッド形式)
repos.user.list(ctx, User.ByEmail("a@b").and(User.ById("u1")), cursor);

// AND 合成 (関数形式)
import { and, or, not } from "~/models/common";
repos.user.list(ctx, and(User.ByEmail("a@b"), User.ById("u1")), cursor);

// 否定
repos.user.list(ctx, not(User.ById("u1")), cursor);
```

### Spec → SQL 変換

`server/src/infra/db/sql-helpers.ts` の `compToSQL(spec, converter)` が AND/OR/NOT を再帰的に SQL に展開する。entity 個別の変換は `repositories/<entity>/postgres/common.ts` に書く。**leaf の discriminated union は model 側 `User.Spec` をそのまま使い、repository 側で再定義しない** (重複を避け、spec 追加時に specToSQL の switch が非網羅エラーになるため):

```typescript
// repositories/user/postgres/common.ts
import type { User } from "@/models/user";

export function userSpecToSQL(spec: User.Spec): SQLFragment {
  switch (spec.type) {
    case "ById":    return sql`id = ${spec.id}`;
    case "ByEmail": return sql`email = ${spec.email}`;
    case "ByIds":   return sql`id IN (${sql.list(spec.ids)})`;
  }
}
```

`get.ts` 等での使用: **`db.queryXxx()` には必ず `sql\`\`` タグ経由で SQLFragment を構築して渡す**。直接 `{ query: ..., params: ... }` オブジェクトを組み立てると、where 句の query 文字列を素の文字列連結で混ぜることになり、`sql` タグの placeholder 合成規約が崩れる (SQL injection 的な事故の温床):

```typescript
// ✅ OK: sql タグで合成
const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
const row = await db.queryGet<UserRow>(
  sql`SELECT * FROM users WHERE ${where} LIMIT 1`,
);

// ❌ NG: 直接オブジェクト構築 (placeholder index のズレや SQL 注入の余地)
const row = await db.queryGet<UserRow>({
  query: `SELECT * FROM users WHERE ${where.query} LIMIT 1`,
  params: where.params,
});
```

`sql` タグは値が `SQLFragment` なら query と params を安全に合成、プリミティブなら `?` + param に展開する。ORDER BY のカラム名など placeholder 化できない要素は `sql.raw(...)` で明示的に生の文字列として混ぜる。

**`SQLFragment` は型レベルで直接構築を禁止**: `server/src/infra/db/sql.ts` 内部に隔離された `unique symbol` ブランドを持ち、外部から `{ query, params }` 形の素オブジェクトを渡しても型エラーになる (構造互換が成立しない)。ファクトリは `sql\`\`` タグ / `sql.raw` / `sql.empty` / `sql.list` / `sql.join` の 5 種類だけ。このうち生文字列を扱うのは **`sql.raw(...)` だけ** なので、コード上で「ここは呼出側が安全性を保証した raw 文字列」が一目でわかる。

新しい spec を増やすときは:
1. `models/<entity>/index.ts` の `_specs` に 1 行追加
2. `repositories/<entity>/postgres/common.ts` の `xxxSpecToSQL` の switch に 1 case 追加
3. Repository インターフェースは **無変更**

---

## Pagination 規約

### 共通型 (`server/src/models/common/pagination.ts`)

```typescript
export interface Cursor<T extends string> {
  limit: number;
  after?: Record<T, string>;
  sort?: Sort<T>;
}

export interface Sort<T extends string> {
  keys: readonly T[];
  order: "asc" | "desc";
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: Record<string, string>;
}
```

### 規約

- **全 list クエリは cursor ベース**。offset は使わない (大規模化時の性能劣化、削除挿入時のズレを避ける)
- `Cursor.limit` は 1 ページの上限件数。Repository 実装は内部で `limit + 1` 件を取り、`hasMore` 判定に使う
- `Cursor.after` は前ページの最後の行の sortKey 値 (例: `{ createdAt: "2024-...", id: "..." }`)
- `Sort.keys` は **複合 sort 必須** (主 sortKey が同値時の決定性のため、必ず `id` を tiebreaker として末尾に含める)
- `Page.nextCursor` は次ページがあるときのみ設定。client は同じものを次の query の `cursor.after` に渡す

### Repository 実装での list

```typescript
export async function list(
  db: Database,
  spec: Comp<User.Spec>,
  cursor: Cursor<User.SortKey>,
): Promise<Page<User>> {
  const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
  const sort = cursor.sort ?? { keys: ["createdAt", "id"] as const, order: "desc" as const };
  // ORDER BY は orderByClause(sort, columnName) で組み立てる。sort.order /
  // sort.keys が外部由来の不正文字列でも、sortDirection / columnName の switch +
  // throw で閉じた値にしか展開されず、SQL injection の入口にならない。
  const orderBy = orderByClause(sort, columnName);
  const limit = cursor.limit + 1;

  const rows = await db.queryAll<UserRow>(
    sql`SELECT * FROM users WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit}`,
  );

  const hasMore = rows.length > cursor.limit;
  const items = rows.slice(0, cursor.limit).map(rowToUser);
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? User.cursor(lastItem, sort.keys) : undefined;

  return { items, hasMore, nextCursor };
}

// repositories/user/postgres/common.ts
// columnName は SQLFragment を返す。sql.raw の引数は常にリテラルで、key が
// dynamic cast で不正値だった場合は switch のどこにも到達せず throw で fail-closed。
export function columnName(key: User.SortKey): SQLFragment {
  switch (key) {
    case "createdAt":  return sql.raw("created_at");
    case "lastLoginAt": return sql.raw("last_login_at");
    case "id":         return sql.raw("id");
  }
  throw new Error(`Invalid sort key: ${String(key)}`);
}
```

**ポイント**: `sql.raw(...)` の引数は **ソースコード上の文字列リテラルだけ** にする。`Sort.order` や `Sort.keys` は TypeScript で型付けされているが JSON パースなどで runtime に任意値が入りうるため、必ず switch を通して閉じた SQLFragment に変換する。dynamic 値を直接 `sql.raw` に渡してはいけない。

`cursor.after` を WHERE 条件に変換するロジックは省略 (一般的には複合 sortKey の tuple 比較。後日必要に応じて `infra/db/sql-helpers.ts` にヘルパー追加)。

---

## Usecase 層

### Phase 構成

`pre → read → process → write → post → result` の 6 phase。全 phase は省略可能 (省略時は identity)。

```
(引数) → pre → preState → read → readState → process → processState → write → writeState → post → postState → result → output
                          └────────────── transaction 内 ──────────────┘
                          └────────────── transaction 外 ─────────────────────────────────┘
```

- `read` / `process` / `write` は **同一トランザクション** で実行
- `pre` / `post` / `result` はトランザクション外
- 各 phase で `fail("CODE", "msg")` を返すと後続 phase は skip され、`Result<T, Fail>` として上位に返る
- **1 usecase = 1 transaction**: 複数 transaction が必要なら usecase を分ける
- **usecase 間呼出禁止**: 共通処理は Model のメソッド/factory に切り出す

### 例

```typescript
import { fail } from "~/models/common";
import { usecase } from "~/usecases/runner";
import { Task } from "~/models/task";

export const updateTaskStatus = (taskId: string, newStatus: Task.Status) =>
  usecase({
    read: async (ctx) => {
      const task = await ctx.repos.task.get(Task.ById(taskId));
      if (!task) return fail("NOT_FOUND", "Task not found");
      return { task };
    },
    process: async (ctx, { task }) => {
      if (!Task.canTransition(task.status, newStatus)) {
        return fail("INVALID_INPUT", "Invalid transition");
      }
      return { ...task, status: newStatus, updatedAt: ctx.now };
    },
    write: async (ctx, task) => {
      await ctx.repos.task.upsert(task);
      return task;
    },
    // result 省略 → write の戻り値がそのまま返る
  });
```

呼出側:
```typescript
const result = await updateTaskStatus(taskId, "done").run(ctx);
return handleResult(result); // tRPC routes
```

---

## Result / Fail 規約

### 型

```typescript
// server/src/models/common/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// server/src/models/common/fail.ts
export interface Fail {
  readonly [FAIL_BRAND]: true;
  readonly code: string;       // "NOT_FOUND" | "INVALID_INPUT" | "DUPLICATE" | "INTERNAL" | "UNAUTHORIZED" | "FORBIDDEN" | ...
  readonly message: string;
  readonly details?: Record<string, unknown>;
}
```

### 規約

- **例外を投げない** (Repository / Usecase / Model 内部)。エラーは `Fail` を return
- `try/catch` は外部 I/O 境界 (Repository 実装内のみ)。catch して `fail("INTERNAL", ...)` に変換
- Presentation 層の `handleResult(result)` で `Result<T, Fail>` → `TRPCError` にマップ:
  - `NOT_FOUND` → `NOT_FOUND`
  - `INVALID_INPUT` → `BAD_REQUEST`
  - `DUPLICATE` → `CONFLICT`
  - `UNAUTHORIZED` → `UNAUTHORIZED`
  - `FORBIDDEN` → `FORBIDDEN`
  - `INTERNAL` → `INTERNAL_SERVER_ERROR`
- `details` には機密情報 (token / password) を絶対入れない

---

## Model 層

### 規約

- I/O なし。pure data + ビジネスルール
- `interface Xxx` (entity 型) + `namespace Xxx` (spec / sortKey / factory / state machine) を同名で並置
- factory: `Xxx.create(params)` で entity 生成 (id 採番、デフォルト値設定)
- state machine: 状態遷移ルール (`Xxx.canTransition(from, to)` 等) は Model に集約

### ファイル配置

```
server/src/models/
├── common/
│   ├── id.ts            # generateId()
│   ├── fail.ts          # Fail / fail() / isFail()
│   ├── result.ts        # Result<T, E>
│   ├── spec.ts          # Comp<T> / defineSpecs / and / or / not
│   ├── pagination.ts    # Cursor / Sort / Page
│   └── index.ts         # re-export
├── user/
│   └── index.ts         # interface + namespace
├── task/
│   └── index.ts
└── ...
```

---

## Presentation 層

### 規約

- tRPC ルーターは **入力検証** (Zod) と **usecase 呼出** のみ
- 入力 (外部型) を Model 型に変換してから usecase に渡す
- Usecase の戻り値 (Model 型 or `Result<T, Fail>`) を `handleResult` で tRPC error に変換
- Repository を直接呼ばない (必ず usecase 経由)

```typescript
export const userRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => getUser(input.id).run(ctx).then(handleResult)),
});
```

---

## まとめ — 新機能追加時の手順

1. **Model 追加**: `models/<entity>/index.ts` で interface + namespace (spec, sortKey, factory)
2. **DB schema**: `schema/tables/<entity>.sql` で CREATE TABLE
3. **Repository interface**: `repositories/<entity>/repository.ts` で標準 5 メソッド
4. **Repository 実装**: `repositories/<entity>/postgres/{common,get,list,count,upsert,delete}.ts`
5. **Repository 登録**: `repositories/index.ts` の `Repos` 型 + `createRawRepos` に追加
6. **Usecase**: `usecases/<feature>/<verb>.ts` で `usecase({...})` を組み立て
7. **Router**: `presentation/trpc/routers/<feature>.ts` で endpoint 公開
8. **テスト**: 各 Repository (`postgres/index.test.ts`)、各 Usecase の主要パスをカバー

新クエリ条件が必要になっても **Repository インターフェースは触らない** — `models/<entity>/index.ts` の `_specs` に 1 行追加するだけ。
