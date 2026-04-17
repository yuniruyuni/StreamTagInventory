# PR 5: テンプレート Y.Doc sync ユースケース + tRPC ルーター

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」第 5 弾。共通設計・セキュリティモデルは [`00-overview.md`](./00-overview.md) を参照。**Repository 規約は [`../architecture.md`](../architecture.md)、データ同期方針は [ADR 0004](../adr/0004-local-first-sync-with-yjs.md) を必読**。

### 前提
- PR 1 で `template_docs` (BYTEA の Y.Doc 状態を 1 ユーザー 1 行で保持) が作成済
- PR 2 で `TemplateDoc` の Model + Repository (標準メソッド `get` / `upsert` / `delete`) が利用可能
- PR 4 で `protectedProcedure` / `Context.user` / `Context.session` / `cookieJar` が整備済
- 旧計画 (`templates` / `user_settings` テーブル + CRUD) は ADR 0004 で撤廃済。本 PR は sync ベースの新設計で書く

### この PR の目的
- `templates.sync` **単一の procedure** を実装: クライアントの state vector と update を受け取り、サーバ側の Y.Doc とマージして差分を返す
- テンプレート本体 (配列) と postTemplate などのユーザー設定は同じ Y.Doc 内に同居する (ADR 0004)
- Y.Doc の破壊的な書込み (サイズ爆撃、不正 shape) をサーバ側で検証し、トランザクションごと reject する
- 全エンドポイントは `protectedProcedure` (認証必須)

### 設計の根拠
- **並行編集・オフライン対応は Y.Doc の性質に委譲**: サーバは state を保管するだけ、conflict 解消ロジックは持たない
- **認証境界は従来通り**: sync も `protectedProcedure` に乗り、`ctx.user.id` を信頼する。クライアントから `userId` を受け取らない
- **1 ユーザー 1 Y.Doc**: `TemplateDoc` の Spec は `{ userId }` のみ、標準メソッドの `get` / `upsert` / `delete` に収まる。`list` / `count` は単一行エンティティにつき実装しない
- **Yjs 知識の隔離**: Repository は BYTEA を読み書きするだけ。Y.Doc の encode/decode / applyUpdate / shape 検証は usecase レイヤー
- **Write-path の排他**: 同一ユーザーの並行 push で片方の update を失わないために、`read → process → write` 内で `SELECT ... FOR UPDATE` を取る (= `DbWriteCtx` 経由の `get` を使う)
- **shape 検証の強制**: `applyUpdate` 後に Y.Doc の構造を検証 (トップレベルキー、各要素の型・長さ・個数)。NG ならトランザクション全体を rollback

### 後続 PR との関係
- PR 6 (frontend tRPC client) が `trpc.templates.sync` を呼ぶ
- PR 7 (移行 UI) が localStorage 旧データを Y.Doc に取り込むロジックを実装

---

## タスク

### 0. 既存パターンの確認

実装前に以下を読むこと:
- [`../architecture.md`](../architecture.md) (必読、特に Repository 標準メソッドと Spec 規約)
- [`../adr/0004-local-first-sync-with-yjs.md`](../adr/0004-local-first-sync-with-yjs.md) (Y.Doc 同期戦略の決定)
- [`02-repository-layer.md`](./02-repository-layer.md) で定義した `TemplateDoc` の Model / Repository
- `client/src/model/template.ts` — 既存 client の Template 型 (Y.Map → client Template 変換の参考。ただし本 PR では client 側を改修しない)
- `server/src/usecases/runner.ts` — usecase pattern

### 1. `server/src/models/templateDoc/index.ts` の前提

PR 2 で以下の shape が定義されている想定:

```typescript
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

Spec は `ByUserId` 一種類のみ。**`findByUserId` のような非標準メソッドは作らない**。PR 2 で list / count を実装しない決定を行っているため、本 PR ではその前提で読み書きするだけ。

### 2. `server/src/usecases/template/sync/shape.ts` を新規作成

Y.Doc の shape / サイズ検証を 1 ファイルに集約する。

```typescript
import type * as Y from "yjs";
import { fail, type Fail } from "../../../models/common";

// 設定値は定数として集約、後で env 化する余地を残す
export const SYNC_LIMITS = {
  /** 1 回の update バイナリの上限 (64 KiB) */
  MAX_UPDATE_BYTES: 64 * 1024,
  /** 保存後の state バイナリの上限 (1 MiB、DB の CHECK 制約と一致) */
  MAX_STATE_BYTES: 1024 * 1024,
  /** テンプレート件数の上限 */
  MAX_TEMPLATES: 500,
  /** 文字列フィールドの上限 */
  MAX_TITLE_LEN: 200,
  MAX_TAG_LEN: 50,
  MAX_TAGS_PER_TEMPLATE: 20,
  MAX_CATEGORY_NAME_LEN: 140,
  MAX_CATEGORY_BOX_ART_URL_LEN: 500,
  MAX_POST_TEMPLATE_LEN: 5000,
} as const;

/** トップレベルで許可するキー (定義外のキーが現れたら reject) */
const ALLOWED_TOP_LEVEL_KEYS = new Set(["templates", "settings"] as const);

export function validateUpdateSize(update: Uint8Array): Fail | null {
  if (update.byteLength > SYNC_LIMITS.MAX_UPDATE_BYTES) {
    return fail("UPDATE_TOO_LARGE", `update exceeds ${SYNC_LIMITS.MAX_UPDATE_BYTES} bytes`);
  }
  return null;
}

export function validateStateSize(state: Uint8Array): Fail | null {
  if (state.byteLength > SYNC_LIMITS.MAX_STATE_BYTES) {
    return fail("STATE_TOO_LARGE", `state exceeds ${SYNC_LIMITS.MAX_STATE_BYTES} bytes`);
  }
  return null;
}

/**
 * applyUpdate 後の Y.Doc を検証する。
 * - トップレベルキーのホワイトリスト
 * - templates 配列の件数・各要素の構造
 * - settings の個別フィールド
 */
export function validateDocShape(doc: Y.Doc): Fail | null {
  // トップレベルキーの確認 (share マップのキーを列挙)
  const shareKeys = Array.from(doc.share.keys());
  for (const key of shareKeys) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key as typeof ALLOWED_TOP_LEVEL_KEYS extends Set<infer U> ? U : never)) {
      return fail("INVALID_DOC_SHAPE", `disallowed top-level key: ${key}`);
    }
  }

  // templates の検証
  const templates = doc.getArray("templates");
  if (templates.length > SYNC_LIMITS.MAX_TEMPLATES) {
    return fail("INVALID_DOC_SHAPE", `too many templates (max ${SYNC_LIMITS.MAX_TEMPLATES})`);
  }
  for (const item of templates) {
    const v = validateTemplateMap(item);
    if (v) return v;
  }

  // settings の検証
  const settings = doc.getMap("settings");
  const postTemplate = settings.get("postTemplate");
  if (postTemplate != null) {
    if (typeof postTemplate !== "string") {
      return fail("INVALID_DOC_SHAPE", "settings.postTemplate must be string");
    }
    if (postTemplate.length > SYNC_LIMITS.MAX_POST_TEMPLATE_LEN) {
      return fail("INVALID_DOC_SHAPE", "settings.postTemplate too long");
    }
  }

  return null;
}

function validateTemplateMap(item: unknown): Fail | null {
  // Y.Map 以外は弾く (import しない unknown 型で済ませる)
  // 実装では Y.Map のインスタンスチェックを Yjs の API に従って行う
  // ...
  // field: id / title / categoryId / categoryName / categoryBoxArtUrl / tags (Y.Array<string>)
  // 個々の長さ・型を SYNC_LIMITS で比較
  // 省略: 実装時に Y.Map の API に合わせて書く
  return null;
}
```

**設計メモ**:
- shape 検証は **「許可されていない構造を作られていないか」** の防御。完全な型検証ではなく、明らかに不正なデータ (巨大文字列、想定外キー、桁外れな件数) を弾くのが目的
- テンプレートの `title` が空文字かどうかといった業務ルールは **サーバでは検査しない** (Y.Doc は編集途中の状態も許容するため)。「Twitch へ適用可能か」は client 側の UI で表示・制御する
- 将来フィールド追加時は `ALLOWED_TOP_LEVEL_KEYS` と `validateTemplateMap` を更新する

### 3. `server/src/usecases/template/sync/index.ts` を新規作成

```typescript
import * as Y from "yjs";
import { ok, type Result, type Fail } from "../../../models/common";
import { TemplateDoc } from "../../../models/templateDoc";
import { usecase } from "../../runner";
import {
  SYNC_LIMITS,
  validateDocShape,
  validateStateSize,
  validateUpdateSize,
} from "./shape";

export interface SyncTemplateDocInput {
  userId: string;
  clientStateVector: Uint8Array;
  clientUpdate: Uint8Array | null;   // 省略可 (読み取り専用 sync)
}

export interface SyncTemplateDocOutput {
  serverUpdate: Uint8Array;
  serverStateVector: Uint8Array;
}

export const createSyncTemplateDocUsecase = (input: SyncTemplateDocInput) =>
  usecase({
    pre: () => {
      if (input.clientUpdate) {
        const v = validateUpdateSize(input.clientUpdate);
        if (v) return v;
      }
      return {};
    },
    // read / process / write は 1 transaction (DbWriteCtx) 内で実行される前提。
    // get(ByUserId) は DbWriteCtx で呼ぶと SELECT ... FOR UPDATE として実装されるため、
    // 並行 push が直列化されて update が失われない。
    write: async (ctx): Promise<Result<SyncTemplateDocOutput, Fail>> => {
      const existing = await ctx.repos.templateDoc.get(TemplateDoc.ByUserId(input.userId));
      const doc = new Y.Doc();
      if (existing) Y.applyUpdate(doc, existing.state);

      if (input.clientUpdate) {
        Y.applyUpdate(doc, input.clientUpdate);

        const shapeFail = validateDocShape(doc);
        if (shapeFail) return shapeFail;

        const newState = Y.encodeStateAsUpdate(doc);
        const sizeFail = validateStateSize(newState);
        if (sizeFail) return sizeFail;

        await ctx.repos.templateDoc.upsert({
          userId: input.userId,
          state: newState,
          sizeBytes: newState.byteLength,
          updatedAt: ctx.now,
        });
      }

      return ok({
        serverUpdate: Y.encodeStateAsUpdate(doc, input.clientStateVector),
        serverStateVector: Y.encodeStateVector(doc),
      });
    },
    result: (output) => output,
  });
```

**ポイント**:
- Repository 呼出は `get(spec)` と `upsert(model)` の **2 つ標準メソッドのみ**
- 権限ガードは `ctx.user.id` 由来の `userId` を `TemplateDoc.ByUserId(...)` に渡すことで自然に成立 (クライアントから受け取らない)
- Yjs 固有の処理 (`applyUpdate` / `encodeStateAsUpdate`) はすべて usecase 内に閉じ、Repository は Uint8Array を読み書きするだけ
- `input.clientUpdate == null` のケース (初回ロードや定期 pull) は「state を書き戻さず、サーバ側の差分だけ返す」
- 検証失敗は `Fail` を return することで usecase runner がトランザクションを rollback する (実装依存: runner の phase 中断仕様に合わせる)

### 4. `server/src/presentation/trpc/routers/templates.ts` を新規作成

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { handleResult } from "../handle-result";
import { createSyncTemplateDocUsecase } from "../../../usecases/template/sync";

const BYTES_B64_SCHEMA = z.string()
  .min(0)
  .max(4 * 128 * 1024)   // base64 膨張を考慮した上限 (MAX_UPDATE_BYTES * 4/3 + α)
  .regex(/^[A-Za-z0-9+/=_-]*$/);

export const templatesRouter = router({
  sync: protectedProcedure
    .input(z.object({
      clientStateVector: BYTES_B64_SCHEMA,
      clientUpdate: BYTES_B64_SCHEMA.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = createSyncTemplateDocUsecase({
        userId: ctx.user.id,
        clientStateVector: fromBase64(input.clientStateVector),
        clientUpdate: input.clientUpdate ? fromBase64(input.clientUpdate) : null,
      });
      const result = await usecase.run(ctx);
      const out = handleResult(result);
      return {
        serverUpdate: toBase64(out.serverUpdate),
        serverStateVector: toBase64(out.serverStateVector),
      };
    }),
});

function toBase64(bytes: Uint8Array): string {
  // Bun / Node: Buffer.from(bytes).toString("base64")
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}
```

**メモ**:
- `sync` は state を変えうる mutation (CSRF 検証対象)。`protectedProcedure` 側で既存の `x-csrf-token` 検証が効くこと
- base64 の文字集合は標準 / URL-safe の両方を受けられる正規表現を使う (client 側は `Buffer.toString("base64")` 想定だが、`y-protocols` 系の URL-safe 出力との互換のため広めに許容)
- Y.Doc バイナリのサイズ検証 (`MAX_UPDATE_BYTES`) は usecase 側で行い、tRPC 層ではおおまかな上限 (base64 膨張後) で早期に弾く
- `bulkUpsert` / `list` / `delete` / `reorder` / `getPostTemplate` / `setPostTemplate` 等の endpoint は **作らない**。全て `sync` に吸収される

### 5. `server/src/presentation/trpc/routers/index.ts` を更新

```typescript
import { router } from "../init";
import { authRouter } from "./auth";
import { templatesRouter } from "./templates";

export const appRouter = router({
  auth: authRouter,
  templates: templatesRouter,
});

export type AppRouter = typeof appRouter;
```

`userSettings` ルーターは **作らない** (postTemplate は Y.Doc 内 `settings` に吸収済)。

---

## テスト

### Unit Test

#### `server/src/usecases/template/sync/shape.test.ts`
- `validateUpdateSize`: 境界値 (65536 OK / 65537 fail)
- `validateStateSize`: 境界値
- `validateDocShape`:
  - 許可されたトップレベルキー (`templates`, `settings`) のみ存在する Y.Doc → OK
  - `templates` 件数が 500 / 501 → OK / fail
  - `settings.postTemplate` が巨大文字列 → fail
  - トップレベルに想定外キー `evil` を追加 → fail
  - template Y.Map に巨大 title → fail
  - tags が 20 個を超える → fail

#### `server/src/usecases/template/sync/index.test.ts`
- 初回 sync (`existing == null` + `clientUpdate != null`): 新規 insert、返却される serverUpdate にすべてのノードが含まれる
- 2 回目 sync (`existing != null` + `clientUpdate != null`): merge されて保存、client が未知の diff のみ返る
- 読み取り専用 sync (`clientUpdate == null`): 書き込み無し、サーバ state そのままの diff を返す
- 大きすぎる update (`MAX_UPDATE_BYTES` 超過) → `UPDATE_TOO_LARGE` fail、DB に書かれない
- 不正な shape の update (禁止キー追加) → `INVALID_DOC_SHAPE` fail、DB に書かれない
- **並行 push の直列化**: 2 つの usecase を並行に発火して両方の update が最終的に保持される (integration test、実 DB を使う)

### Integration Test

`server/src/repositories/templateDoc/postgres/index.test.ts` 相当で `get` / `upsert` / `delete` の基本挙動と `FOR UPDATE` (DbWriteCtx 経由) の直列化を検証。

### 実行
```bash
bun run check:test
```

---

## Definition of Done

- [ ] `server/src/usecases/template/sync/{index,shape}.ts` 作成
- [ ] `server/src/usecases/template/sync/{index,shape}.test.ts` 作成
- [ ] `server/src/presentation/trpc/routers/templates.ts` 作成 (`sync` 単一 procedure)
- [ ] `server/src/presentation/trpc/routers/index.ts` で `appRouter` に統合
- [ ] **`userSettings` router / usecase は作らない**（Y.Doc 内に統合済）
- [ ] **`list` / `upsert` / `bulkUpsert` / `delete` / `reorder` 系 usecase / endpoint は作らない**（sync 1 本に吸収済）
- [ ] Repository 呼出は標準メソッド (`get` / `upsert`) のみ
- [ ] 権限ガードは `ctx.user.id` から `TemplateDoc.ByUserId` を生成することで自動成立
- [ ] shape 検証が全トップレベルキーと各フィールドをカバー
- [ ] サイズ制限 (`MAX_UPDATE_BYTES` / `MAX_STATE_BYTES`) が usecase で効く
- [ ] 並行 push の直列化 integration test が通る
- [ ] `bun run check` 全緑
- [ ] `bun run build` 成功

---

## 既知の落とし穴

- **旧計画の誘惑**: `list/upsert/delete/reorder/bulkUpsert` を復活させない。全て `sync` に吸収済 (ADR 0004)。レビュー時に旧 API が滑り込んでいないか確認
- **`userSettings` router を作らない**: postTemplate は Y.Doc `settings` に入る。サーバ側で別テーブル / 別 router を作らない
- **FOR UPDATE を忘れない**: `get` を `DbReadCtx` で呼ぶと SELECT だけで終わり、並行 push が同じベースに書いて片方ロストする。`DbWriteCtx` 経由で呼ぶ (= usecase の write phase 内) こと
- **shape 検証を applyUpdate の「後」で行う**: 先に検証してから applyUpdate するのは無意味 (update は opaque バイナリ)。`applyUpdate` → `validateDocShape` の順で、失敗時は transaction rollback
- **巨大 update の DoS**: base64 膨張を考慮して tRPC 層でも早期に入力サイズを弾く。`MAX_UPDATE_BYTES` * 4/3 + マージンを tRPC の Zod に設定
- **shape 検証は攻撃防御、業務ルールではない**: 「title が空」「tags が 0 個」等は Y.Doc 編集途中の正当な状態。Twitch 適用時の UI チェックで制御する
- **Y.Doc 内部構造の変更は慎重に**: `ALLOWED_TOP_LEVEL_KEYS` の変更はデータ互換を壊す可能性。変更時は client / server / 移行ロジックの 3 箇所を同時更新
- **base64 encoding の揺れ**: 標準 / URL-safe / パディング有無が混在するとデコード時にエラーになる。サーバ・クライアント双方で `Buffer.toString("base64")` / `Buffer.from(_, "base64")` を基準にする
- **`ctx.now` の扱い**: `updated_at` は server 時刻で埋める。client から受け取らない
