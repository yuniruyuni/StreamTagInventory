# PR 2: Model 層 + Repository 層

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」第 2 弾。共通設計・セキュリティモデルは [`00-overview.md`](./00-overview.md) を参照。

### 前提
- PR 1 で 4 テーブル (`users`, `sessions`, `oidc_nonces`, `template_docs`) が作成済。`templates` / `user_settings` テーブルは ADR 0004 により存在しない
- Backend の Model / Repository は現在空 (`Repos = {}`)
- `server/src/models/common/` には `id`, `fail`, `result`, `cursor` のみ存在 → 本 PR で **`spec.ts` と `pagination.ts` を新規作成**
- `server/src/infra/db/` に **`sql-helpers.ts` が未存在** → 本 PR で新規作成

### この PR の目的
1. `server/src/models/common/` の拡張: `spec.ts` (Spec Pattern の基盤) と `pagination.ts` (Cursor/Sort/Page) を追加
2. `server/src/infra/db/sql-helpers.ts` の新規作成: `compToSQL` (spec→SQL 変換) と日付ヘルパー
3. 各 entity の Model 定義 (`models/<entity>/index.ts`): entity 型 + spec + sortKey + factory
4. 各 entity の Repository 定義 (`repositories/<entity>/`): interface + postgres 実装
5. `repositories/index.ts` で `Repos` 型統合

### 設計の根拠
**本 PR のすべての Repository / Model 設計は [`../architecture.md`](../architecture.md) に完全準拠する**。具体的には:

- Repository は **標準 5 メソッド** (`get` / `list` / `count` / `upsert` / `delete`) のみ
- **`findByXxx` / `listByXxx` / `findByIdOwnedBy` 等のメソッドを絶対に作らない**
- 条件は `models/<entity>/index.ts` の `defineSpecs` で定義、Repository 呼出側で `User.ById(id)` のように合成

本プロジェクトは AutoKanban → template の系譜で、この規約は全プロジェクト共通。

### 後続 PR との関係
- PR 3 (auth ユースケース) が `repos.user.get(User.ByTwitchUserId(sub))` / `repos.session.upsert(session)` / `repos.oidcNonce.delete(OidcNonce.ByValue(nonce))` などを使う
- PR 5 (Y.Doc sync ルーター) が `repos.templateDoc.get(TemplateDoc.ByUserId(u))` / `repos.templateDoc.upsert(doc)` を使う

---

## タスク

### 0. 既存パターンの確認

実装前に以下を読むこと:
- **[`../architecture.md`](../architecture.md)** (必読): 規約全体。特に「Repository 層」「Spec 規約」「Pagination 規約」
- `server/src/repositories/common/capability.ts` — 能力マーカーの定義
- `server/src/infra/db/sql.ts` — `sql` タグ、`SQLFragment` 型、`sql.join` / `sql.list` / `sql.empty`
- `server/src/infra/db/database.ts` — `Database` インターフェース
- `server/src/models/common/{result,fail,id}.ts` — 既存モデル共通型
- AutoKanban の参考実装 (type 参照のみ、コピペ禁止):
  - `/home/yuniruyuni/src/github.com/yuniruyuni/AutoKanban/server/src/models/common/spec.ts`
  - `/home/yuniruyuni/src/github.com/yuniruyuni/AutoKanban/server/src/models/common/pagination.ts`
  - `/home/yuniruyuni/src/github.com/yuniruyuni/AutoKanban/server/src/infra/db/sql-helpers.ts`
  - `/home/yuniruyuni/src/github.com/yuniruyuni/AutoKanban/server/src/models/task/index.ts` (spec 定義の好例)
  - `/home/yuniruyuni/src/github.com/yuniruyuni/AutoKanban/server/src/repositories/task/` (Repository 実装の好例)

### 1. `server/src/models/common/spec.ts` を新規作成

AutoKanban の `server/src/models/common/spec.ts` を参考に以下を実装:

- `interface CompMethods<T>` (`and` / `or` / `not` メソッド)
- `type Comp<T>` (単純 spec または AND / OR / NOT 合成)
- `addCompMethods<T>(obj)` — ランタイムで合成メソッドを付与
- `and<T>(...children)` / `or<T>(...children)` / `not<T>(child)` — トップレベル関数
- `isCompLogical<T>(value)` — AND/OR/NOT かを判定する type guard
- `defineSpecs<T>(specs)` — spec factory を一括定義 (各 factory が `Comp<...>` を返す)
- `SpecsOf<T>` — factory の戻り値 Spec 型を抽出するユーティリティ型

### 2. `server/src/models/common/pagination.ts` を新規作成

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

既存の `models/common/cursor.ts` がある場合は統合 (重複しないように `cursor.ts` を削除するか、`pagination.ts` にリネーム)。

### 3. `server/src/models/common/index.ts` を更新

```typescript
export { FAIL_BRAND, type Fail, fail, isFail, type Unfail } from "./fail";
export { generateId } from "./id";
export type { Cursor, Page, Sort } from "./pagination";
export {
  and,
  type Comp,
  type CompMethods,
  defineSpecs,
  isCompLogical,
  not,
  or,
  type SpecsOf,
} from "./spec";
export type { Result } from "./result";
```

### 4. `server/src/infra/db/sql-helpers.ts` を新規作成

AutoKanban の `server/src/infra/db/sql-helpers.ts` を参考に:

```typescript
import { type Comp, isCompLogical } from "../../models/common";
import { type SQLFragment, sql } from "./sql";

export function compToSQL<T>(
  spec: Comp<T>,
  convert: (s: T) => SQLFragment,
): SQLFragment {
  if (isCompLogical(spec)) {
    switch (spec.type) {
      case "and": {
        if (spec.children.length === 0) return sql.empty();
        const fragments = spec.children.map((c) => compToSQL(c, convert));
        return sql`(${sql.join(fragments, " AND ")})`;
      }
      case "or": {
        if (spec.children.length === 0) return sql`1=0`;
        const fragments = spec.children.map((c) => compToSQL(c, convert));
        return sql`(${sql.join(fragments, " OR ")})`;
      }
      case "not": {
        const child = compToSQL(spec.child, convert);
        return sql`NOT (${child})`;
      }
    }
  }
  return convert(spec as T);
}

export function dateFromSQL(value: string | Date): Date {
  return new Date(value);
}

export function dateToSQL(value: Date): string {
  return value.toISOString();
}
```

テスト: `server/src/infra/db/sql-helpers.test.ts` で AND / OR / NOT ネスト / 空 children のケースを全部カバー。

### 5. `server/src/models/user/index.ts` を新規作成

```typescript
import { type Comp, defineSpecs, type SpecsOf, generateId } from "../common";

export interface User {
  id: string;
  twitchUserId: string;
  login: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

export namespace User {
  export type SortKey = "createdAt" | "lastLoginAt" | "id";

  const _specs = defineSpecs({
    ById: (id: string) => ({ id }),
    ByTwitchUserId: (twitchUserId: string) => ({ twitchUserId }),
  });
  export const ById = _specs.ById;
  export const ByTwitchUserId = _specs.ByTwitchUserId;

  export type Spec = Comp<SpecsOf<typeof _specs>>;

  export function cursor(u: User, keys: readonly SortKey[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = u[key];
      result[key] = value instanceof Date ? value.toISOString() : String(value);
    }
    return result;
  }

  // factory — auth.login usecase が呼ぶ
  export function create(params: {
    twitchUserId: string;
    login: string;
    displayName: string;
    now: Date;
  }): User {
    return {
      id: generateId(),
      twitchUserId: params.twitchUserId,
      login: params.login,
      displayName: params.displayName,
      createdAt: params.now,
      updatedAt: params.now,
      lastLoginAt: params.now,
    };
  }
}
```

### 6. `server/src/models/session/index.ts` を新規作成

```typescript
import { type Comp, defineSpecs, type SpecsOf, generateId } from "../common";

export interface Session {
  id: string;
  userId: string;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
}

export namespace Session {
  export type SortKey = "createdAt" | "lastSeenAt" | "id";

  const _specs = defineSpecs({
    ById: (id: string) => ({ id }),
    ByUserId: (userId: string) => ({ userId }),
    // 期限切れ判定用 (auth middleware での lookup で使う)
    ActiveAt: (at: Date) => ({ activeAt: at }),  // expires_at > at
    Expired: () => ({ expired: true as const }), // expires_at <= now()
  });
  export const ById = _specs.ById;
  export const ByUserId = _specs.ByUserId;
  export const ActiveAt = _specs.ActiveAt;
  export const Expired = _specs.Expired;

  export type Spec = Comp<SpecsOf<typeof _specs>>;

  export function cursor(s: Session, keys: readonly SortKey[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = s[key];
      result[key] = value instanceof Date ? value.toISOString() : String(value);
    }
    return result;
  }

  export function create(params: {
    userId: string;
    csrfToken: string;
    expiresAt: Date;
    now: Date;
  }): Session {
    return {
      id: generateId(),
      userId: params.userId,
      csrfToken: params.csrfToken,
      createdAt: params.now,
      expiresAt: params.expiresAt,
      lastSeenAt: params.now,
    };
  }
}
```

### 7. `server/src/models/oidcNonce/index.ts` を新規作成

```typescript
import { type Comp, defineSpecs, type SpecsOf } from "../common";

export interface OidcNonce {
  nonce: string;
  createdAt: Date;
  expiresAt: Date;
}

export namespace OidcNonce {
  export type SortKey = "createdAt" | "nonce";

  const _specs = defineSpecs({
    ByValue: (nonce: string) => ({ nonce }),
    Expired: () => ({ expired: true as const }),  // expires_at <= now()
    ActiveAt: (at: Date) => ({ activeAt: at }),   // expires_at > at
  });
  export const ByValue = _specs.ByValue;
  export const Expired = _specs.Expired;
  export const ActiveAt = _specs.ActiveAt;

  export type Spec = Comp<SpecsOf<typeof _specs>>;

  export function cursor(n: OidcNonce, keys: readonly SortKey[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = n[key];
      result[key] = value instanceof Date ? value.toISOString() : String(value);
    }
    return result;
  }

  export function create(params: { nonce: string; expiresAt: Date; now: Date }): OidcNonce {
    return {
      nonce: params.nonce,
      createdAt: params.now,
      expiresAt: params.expiresAt,
    };
  }
}
```

### 8. `server/src/models/templateDoc/index.ts` を新規作成

Yjs の Y.Doc バイナリを 1 ユーザー 1 行で保持する単一行エンティティ (ADR 0004)。テンプレート本体・ユーザー設定 (postTemplate) はすべて Y.Doc 内部に収まるため、`Template` / `UserSettings` という entity は **存在しない** (旧計画からの変更)。

```typescript
import { type Comp, defineSpecs, type SpecsOf } from "../common";

export interface TemplateDoc {
  userId: string;
  state: Uint8Array;       // Y.encodeStateAsUpdate(doc) の結果
  sizeBytes: number;
  updatedAt: Date;
}

export namespace TemplateDoc {
  export type SortKey = "userId";

  const _specs = defineSpecs({
    ByUserId: (userId: string) => ({ userId }),
  });
  export const ByUserId = _specs.ByUserId;

  export type Spec = Comp<SpecsOf<typeof _specs>>;

  export function cursor(d: TemplateDoc, keys: readonly SortKey[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) result[key] = String(d[key]);
    return result;
  }
}
```

**設計メモ**:
- Spec は `ByUserId` のみ (1 行 1 ユーザーで他の検索軸が存在しない)。**これは spec パターンの例外ではなく、spec を 1 つしか持たない普通の適用**
- `create` / `validate` のような factory / business rule は **このモデルには持たせない**: Y.Doc の生成・検証は「バイナリを applyUpdate してから行う」性質のため、usecase 層 (PR 5 の `validateDocShape`) で行う
- `state` は `Uint8Array`。DB の BYTEA と 1:1
- `updatedAt` は server 時刻。sync ごとに `ctx.now` で上書き

### 9. 各 Repository の interface と Postgres 実装

4 entity 分 (`user` / `session` / `oidcNonce` / `templateDoc`)、以下を作る。具体例として `user` を詳述、他は同パターンで実装。`templateDoc` のみ `list` / `count` 未実装の縮小版 (上記 8 節の設計メモ参照)。

#### `server/src/repositories/user/repository.ts`

```typescript
import type { Cursor, Page } from "../../models/common";
import type { User } from "../../models/user";
import type { DbReadCtx, DbWriteCtx } from "../common/capability";

export interface UserRepository {
  get(ctx: DbReadCtx, spec: User.Spec): Promise<User | null>;
  list(ctx: DbReadCtx, spec: User.Spec, cursor: Cursor<User.SortKey>): Promise<Page<User>>;
  count(ctx: DbReadCtx, spec: User.Spec): Promise<number>;
  upsert(ctx: DbWriteCtx, user: User): Promise<void>;
  delete(ctx: DbWriteCtx, spec: User.Spec): Promise<number>;
}
```

#### `server/src/repositories/user/postgres/common.ts`

```typescript
import { type SQLFragment, sql } from "../../../infra/db/sql";
import { dateFromSQL } from "../../../infra/db/sql-helpers";
import type { User } from "../../../models/user";

export interface UserRow {
  id: string;
  twitch_user_id: string;
  login: string;
  display_name: string;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string;
}

type UserSpecData =
  | { type: "ById"; id: string }
  | { type: "ByTwitchUserId"; twitchUserId: string };

export function userSpecToSQL(spec: UserSpecData): SQLFragment {
  switch (spec.type) {
    case "ById":
      return sql`id = ${spec.id}`;
    case "ByTwitchUserId":
      return sql`twitch_user_id = ${spec.twitchUserId}`;
  }
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    twitchUserId: row.twitch_user_id,
    login: row.login,
    displayName: row.display_name,
    createdAt: dateFromSQL(row.created_at),
    updatedAt: dateFromSQL(row.updated_at),
    lastLoginAt: dateFromSQL(row.last_login_at),
  };
}

export function columnName(key: User.SortKey): string {
  const map: Record<User.SortKey, string> = {
    createdAt: "created_at",
    lastLoginAt: "last_login_at",
    id: "id",
  };
  return map[key];
}
```

#### `server/src/repositories/user/postgres/get.ts`

```typescript
import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { User } from "../../../models/user";
import { rowToUser, type UserRow, userSpecToSQL } from "./common";

export async function get(db: Database, spec: User.Spec): Promise<User | null> {
  const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
  const row = await db.queryGet<UserRow>({
    query: `SELECT * FROM users WHERE ${where.query} LIMIT 1`,
    params: where.params,
  });
  return row ? rowToUser(row) : null;
}
```

#### `server/src/repositories/user/postgres/list.ts`

```typescript
import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { Cursor, Page } from "../../../models/common";
import { User } from "../../../models/user";
import { columnName, rowToUser, type UserRow, userSpecToSQL } from "./common";

export async function list(
  db: Database,
  spec: User.Spec,
  cursor: Cursor<User.SortKey>,
): Promise<Page<User>> {
  const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
  const sort = cursor.sort ?? { keys: ["createdAt", "id"] as const, order: "desc" as const };
  const orderBy = sort.keys
    .map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
    .join(", ");
  const limit = cursor.limit + 1;

  const rows = await db.queryAll<UserRow>({
    query: `SELECT * FROM users WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
    params: where.params,
  });

  const hasMore = rows.length > cursor.limit;
  const items = rows.slice(0, cursor.limit).map(rowToUser);
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? User.cursor(lastItem, sort.keys) : undefined;

  return { items, hasMore, nextCursor };
}
```

#### `server/src/repositories/user/postgres/count.ts`

```typescript
import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { User } from "../../../models/user";
import { userSpecToSQL } from "./common";

export async function count(db: Database, spec: User.Spec): Promise<number> {
  const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
  const row = await db.queryGet<{ count: string }>({
    query: `SELECT COUNT(*)::text AS count FROM users WHERE ${where.query}`,
    params: where.params,
  });
  return Number(row?.count ?? 0);
}
```

#### `server/src/repositories/user/postgres/upsert.ts`

```typescript
import type { Database } from "../../../infra/db/database";
import { dateToSQL } from "../../../infra/db/sql-helpers";
import type { User } from "../../../models/user";

export async function upsert(db: Database, user: User): Promise<void> {
  await db.queryRun({
    query: `INSERT INTO users (id, twitch_user_id, login, display_name, created_at, updated_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (twitch_user_id) DO UPDATE SET
              login = EXCLUDED.login,
              display_name = EXCLUDED.display_name,
              updated_at = EXCLUDED.updated_at,
              last_login_at = EXCLUDED.last_login_at`,
    params: [
      user.id,
      user.twitchUserId,
      user.login,
      user.displayName,
      dateToSQL(user.createdAt),
      dateToSQL(user.updatedAt),
      dateToSQL(user.lastLoginAt),
    ],
  });
}
```

**注意点**:
- `ON CONFLICT` 節は `twitch_user_id` (UNIQUE 制約あり) で衝突検出
- `CONFLICT (id)` だと新規 user を挿入するたびに id 変えて衝突しないので用途に合わない
- 「identity マッピングの upsert」は `twitch_user_id` で決まる、id は自動採番

#### `server/src/repositories/user/postgres/delete.ts`

```typescript
import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { User } from "../../../models/user";
import { userSpecToSQL } from "./common";

export async function del(db: Database, spec: User.Spec): Promise<number> {
  const where = compToSQL(spec, userSpecToSQL as (s: unknown) => SQLFragment);
  const { rowCount } = await db.queryRun({
    query: `DELETE FROM users WHERE ${where.query}`,
    params: where.params,
  });
  return rowCount;
}
```

#### `server/src/repositories/user/postgres/index.ts`

```typescript
import type { Cursor, Page } from "../../../models/common";
import type { User } from "../../../models/user";
import type { DbReadCtx, DbWriteCtx } from "../../common/capability";
import type { UserRepository as IUserRepository } from "../repository";
import { count } from "./count";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class UserRepository implements IUserRepository {
  async get(ctx: DbReadCtx, spec: User.Spec): Promise<User | null> {
    return get(ctx.db, spec);
  }
  async list(ctx: DbReadCtx, spec: User.Spec, cursor: Cursor<User.SortKey>): Promise<Page<User>> {
    return list(ctx.db, spec, cursor);
  }
  async count(ctx: DbReadCtx, spec: User.Spec): Promise<number> {
    return count(ctx.db, spec);
  }
  async upsert(ctx: DbWriteCtx, user: User): Promise<void> {
    return upsert(ctx.db, user);
  }
  async delete(ctx: DbWriteCtx, spec: User.Spec): Promise<number> {
    return del(ctx.db, spec);
  }
}
```

#### `server/src/repositories/user/index.ts`

```typescript
export type { UserRepository } from "./repository";
export { UserRepository as PgUserRepository } from "./postgres";
```

### 10. 同パターンで session / oidcNonce / templateDoc を実装

それぞれ以下の構造:

```
server/src/repositories/<entity>/
├── repository.ts
├── index.ts
└── postgres/
    ├── index.ts
    ├── common.ts         # row 型 / specToSQL / rowToModel / columnName
    ├── get.ts
    ├── list.ts
    ├── count.ts
    ├── upsert.ts
    ├── delete.ts
    └── index.test.ts
```

#### entity 別の注意点

**session**:
- `specToSQL` の `ActiveAt` は `expires_at > $at` に展開
- `Expired` は `expires_at <= now()` に展開
- session の `last_seen_at` touch は **`upsert` メソッドで行う** (標準メソッド以外を作らない)。呼出側で `Session.create({ ..., lastSeenAt: now })` を渡し直すか、usecase で `session` を取得 → 新 `lastSeenAt` を設定 → `upsert` で保存

**oidcNonce**:
- **`consume` という非標準メソッドを作らない**。Usecase 側で `delete(OidcNonce.ByValue(n).and(OidcNonce.ActiveAt(now))); 影響行数 > 0 ? consume成功 : 失敗` の判定を行う
- `delete` の戻り値 (影響行数) で atomic な「取って消す」が実現できる
- `specToSQL` の `ActiveAt` は `expires_at > $at` に展開

**templateDoc**:
- テーブルは `template_docs`、PK = `user_id`、行の中身は `state BYTEA` / `size_bytes INTEGER` / `updated_at TIMESTAMPTZ`
- `specToSQL` は `ByUserId` 1 ケースのみ: `user_id = ${spec.userId}`
- `rowToTemplateDoc` で `state` を `Uint8Array` に、`size_bytes` を `number` に変換 (`pg` の BYTEA は `Buffer` で返るので `new Uint8Array(buf)` で変換)
- `upsert` の `ON CONFLICT` は `(user_id)` で検出、`state` / `size_bytes` / `updated_at` を更新
- **`list` / `count` は実装しない** (単一行エンティティで無意味、`interface TemplateDocRepository` からも除外する)。これは標準メソッド規約の例外ではなく「使わないメソッドを省略する」通常の適用
- **`get` を `DbWriteCtx` で呼ぶと `SELECT ... FOR UPDATE`** として実装する。write transaction 内での並行更新を直列化するため (PR 5 の sync usecase がこれに依存)
- `DbReadCtx` 経由の `get` は通常の `SELECT` (例: health check や管理画面など将来用途)

### 11. `server/src/repositories/index.ts` を更新

```typescript
import { PgOidcNonceRepository } from "./oidcNonce";
import { PgSessionRepository } from "./session";
import { PgTemplateDocRepository } from "./templateDoc";
import { PgUserRepository } from "./user";
import type { OidcNonceRepository } from "./oidcNonce/repository";
import type { SessionRepository } from "./session/repository";
import type { TemplateDocRepository } from "./templateDoc/repository";
import type { UserRepository } from "./user/repository";

export type Repos = {
  user: UserRepository;
  session: SessionRepository;
  oidcNonce: OidcNonceRepository;
  templateDoc: TemplateDocRepository;
};

export function createRawRepos(): Repos {
  return {
    user: new PgUserRepository(),
    session: new PgSessionRepository(),
    oidcNonce: new PgOidcNonceRepository(),
    templateDoc: new PgTemplateDocRepository(),
  };
}
```

`bindAllRepos` が ctx 注入を自動化するため、Repository class はステートレス (`new` するだけで OK)。

`TemplateDocRepository` の interface は `list` / `count` を持たない点が他と異なる:

```typescript
export interface TemplateDocRepository {
  get(ctx: DbReadCtx | DbWriteCtx, spec: TemplateDoc.Spec): Promise<TemplateDoc | null>;
  upsert(ctx: DbWriteCtx, doc: TemplateDoc): Promise<void>;
  delete(ctx: DbWriteCtx, spec: TemplateDoc.Spec): Promise<number>;
}
```

---

## テスト

### Unit Test

#### `server/src/infra/db/sql-helpers.test.ts`
- `compToSQL` の AND / OR / NOT の各パス、ネスト、空 children
- `dateFromSQL` / `dateToSQL` のラウンドトリップ

#### `server/src/models/common/spec.test.ts`
- `defineSpecs` が正しく factory を生成
- `.and()` / `.or()` / `.not()` の合成
- `isCompLogical` の判定

#### `server/src/repositories/<entity>/postgres/index.test.ts`
各 entity で以下をカバー (実 PostgreSQL を使う integration test):

- `get`: spec 単純 / 存在しないで null / AND 合成
- `list`: cursor のページング、`hasMore` / `nextCursor` の正確性 (user / session / oidcNonce のみ、templateDoc は対象外)
- `count`: spec 単純 / 合成 (user / session / oidcNonce のみ)
- `upsert`: 新規挿入 / 既存更新の両方、冪等性
- `delete`: 影響行数、spec 合成による範囲削除

#### 重要なテストケース (atomic 挙動)

- **`oidcNonce`** の `delete(OidcNonce.ByValue(n).and(OidcNonce.ActiveAt(now)))` が `now < expires_at` な行だけ削除する atomicity
- **`user`** の `upsert` を同一 twitch_user_id で 2 回実行して `last_login_at` が更新される
- **`templateDoc`** の `upsert` が既存 `user_id` で `state` / `size_bytes` を上書き、`updated_at` が更新される
- **`templateDoc`** の `get` を `DbWriteCtx` 経由で呼ぶと `FOR UPDATE` ロックが取得される (並行トランザクションが block されることを確認)

### 実行
```bash
bun run check:test
```

---

## Definition of Done

- [ ] `server/src/models/common/spec.ts` 作成 (+ `spec.test.ts`)
- [ ] `server/src/models/common/pagination.ts` 作成 (既存 `cursor.ts` を統合 or 削除)
- [ ] `server/src/models/common/index.ts` を更新
- [ ] `server/src/infra/db/sql-helpers.ts` 作成 (+ `sql-helpers.test.ts`)
- [ ] `server/src/models/{user,session,oidcNonce,templateDoc}/index.ts` 作成（`template` / `userSettings` は作らない）
- [ ] `server/src/repositories/{user,session,oidcNonce}/` 作成 (各 `repository.ts` + `postgres/` 6 ファイル + `index.test.ts`)
- [ ] `server/src/repositories/templateDoc/` 作成 (`repository.ts` + `postgres/` は `get` / `upsert` / `delete` の 4 ファイル + `common.ts` + `index.test.ts`、`list.ts` / `count.ts` は作らない)
- [ ] `server/src/repositories/index.ts` で `Repos` 型統合
- [ ] `bun run check:type` / `check:lint` / `check:test` 全緑
- [ ] `bun run build` 成功
- [ ] 以下のチェックリストを満たす:
  - [ ] **`findByXxx` メソッドがどこにも存在しない** (grep で確認)
  - [ ] 全 Repository のメソッドは標準メソッド (`get` / `list` / `count` / `upsert` / `delete`) のサブセットのみ (未使用メソッドは省略可、独自メソッドは追加しない)
  - [ ] 全 Model namespace に `defineSpecs` による spec 定義がある
  - [ ] `list` の戻り値が `Page<T>` で `hasMore` / `nextCursor` を含む
  - [ ] `oidcNonce.delete(spec.and(ActiveAt(now)))` の atomic consume パターンを test で確認

---

## 既知の落とし穴

- **`findByXxx` の誘惑**: 「このクエリ 1 回だけだから個別メソッドでいい」は NG。必ず spec で表現。例外なし
- **JSONB の型変換**: `pg` は JSONB を自動 parse するが、`unknown` を返す。runtime check で `string[]` を保証
- **`upsert` の `ON CONFLICT` カラム**: `user` は `twitch_user_id`、`templateDoc` は `user_id`、`session` / `oidcNonce` は `id` (PRIMARY KEY)。entity によって違うので注意
- **Transaction の責務**: Repository 内で `ctx.db.transaction` を張らない。usecase runner の write phase が包むか、usecase 内で `ctx.db.transaction` を張る。Repository は単一 SQL を実行するだけ
- **能力マーカーの誤用**: `get` / `list` / `count` は `DbReadCtx`、`upsert` / `delete` は `DbWriteCtx`。順序を間違えない
- **`count` の型**: PostgreSQL の `COUNT(*)` は `bigint` を返し、`pg` lib は string として返すことが多い。`::text` で明示キャスト → `Number(...)` で変換が安全
- **spec の discriminator**: `defineSpecs` が `type: "ById"` を自動付与。`specToSQL` の switch で `case "ById"` のように使う
- **`sql` タグの `?` プレースホルダー**: 既存の `sql.ts` が `?` → `$1` 変換している前提。変換タイミングが `queryGet` / `queryRun` 内か、`sql` タグ内か要確認 (AutoKanban の実装では `?` をそのまま保持し、pg-client が `$N` に変換)
- **`cursor.after` の実装**: 本 PR では `after` に基づくカーソル位置の SQL 変換は省略 (PR 5 以降のテンプレート list で必要になったら `sql-helpers.ts` に追加)。initial limit-only pagination で十分
- **既存の `server/src/models/common/cursor.ts`**: もし既に存在するなら、`pagination.ts` にリネームして `Cursor` / `Sort` / `Page` を整備。import 箇所を全部更新
