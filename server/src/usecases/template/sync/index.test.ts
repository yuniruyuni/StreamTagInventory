import { beforeEach, describe, expect, test } from "bun:test";
import { generateTestTwitchUserId } from "@test/factories";
import { createTestContext } from "@test/helpers/context";
import { createTestDB } from "@test/helpers/db";
import * as Y from "yjs";
import type { Database } from "@/infra/db/database";
import { SYNC_LIMITS, TemplateDoc } from "@/models/templateDoc";
import { createDbWriteCtx } from "@/repositories/common";
import { createDefault as createTemplateDocRepo } from "@/repositories/templateDoc";
import { syncTemplateDoc } from ".";

let db: Database;
let userId: string;

beforeEach(async () => {
  db = await createTestDB();
  // ADR 0007: user は DB に保持せず JWT claim (sub = Twitch user id) だけが truth。
  // test で必要なのはユニークな string 1 つ。
  userId = generateTestTwitchUserId();
});

/**
 * 空 Y.Doc の state vector エンコーディング。Yjs の state vector は空 bytes
 * ではなく空 doc を encodeStateVector した結果が「何も知らない」の正規表現。
 */
function emptyStateVector(): Uint8Array {
  return Y.encodeStateVector(new Y.Doc());
}

/** クライアント側の Y.Doc を作り、state vector / update を取り出すヘルパー */
function makeClientDoc(mutate?: (doc: Y.Doc) => void): {
  doc: Y.Doc;
  sv: Uint8Array;
  update: Uint8Array;
} {
  const doc = new Y.Doc();
  if (mutate) mutate(doc);
  return {
    doc,
    sv: Y.encodeStateVector(doc),
    update: Y.encodeStateAsUpdate(doc),
  };
}

describe("syncTemplateDoc", () => {
  test("initial sync persists clientUpdate and returns matching server diff", async () => {
    const { sv, update } = makeClientDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t1");
      m.set("title", "hello");
      arr.push([m]);
    });

    const result = await syncTemplateDoc.run(createTestContext(db), {
      userId,
      clientStateVector: emptyStateVector(), // 真の初回 = 空 Y.Doc の sv
      clientUpdate: update,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // DB に state が保存されている
    const stored = await createTemplateDocRepo().get(
      createDbWriteCtx(db),
      TemplateDoc.ByUserId(userId),
    );
    expect(stored).not.toBeNull();
    expect(stored?.sizeBytes).toBeGreaterThan(0);

    // serverUpdate を空の client doc に適用すると元の内容が復元される
    const rehydrated = new Y.Doc();
    Y.applyUpdate(rehydrated, result.value.serverUpdate);
    const templates = rehydrated.getArray<Y.Map<unknown>>("templates");
    expect(templates.length).toBe(1);
    expect(templates.get(0).get("title")).toBe("hello");

    // 次回 sync の参考用 state vector を返している
    expect(result.value.serverStateVector.byteLength).toBeGreaterThan(0);

    // sv を渡すと使われる参考 (この test 自体は client side 相当)
    expect(sv).toBeInstanceOf(Uint8Array);
  });

  test("read-only sync (clientUpdate = null) does not change server state", async () => {
    // 先に初回 push でサーバ state を作る
    const init = makeClientDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t1");
      m.set("title", "hello");
      arr.push([m]);
    });
    await syncTemplateDoc.run(createTestContext(db), {
      userId,
      clientStateVector: emptyStateVector(),
      clientUpdate: init.update,
    });
    const before = await createTemplateDocRepo().get(
      createDbWriteCtx(db),
      TemplateDoc.ByUserId(userId),
    );

    // 別 client (sv 空) が read-only sync
    const result = await syncTemplateDoc.run(createTestContext(db), {
      userId,
      clientStateVector: emptyStateVector(),
      clientUpdate: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // server の state は書き換わっていない (updatedAt ピンポイントでは厳密検査しにくいので size_bytes で代理確認)
    const after = await createTemplateDocRepo().get(
      createDbWriteCtx(db),
      TemplateDoc.ByUserId(userId),
    );
    expect(after?.sizeBytes).toBe(before?.sizeBytes ?? -1);

    // read-only でも serverUpdate には差分が乗る (client sv が空なので全内容)
    const rehydrated = new Y.Doc();
    Y.applyUpdate(rehydrated, result.value.serverUpdate);
    expect(rehydrated.getArray("templates").length).toBe(1);
  });

  test("second push merges with existing state (no data loss)", async () => {
    // 1 回目: t1 を push
    const a = makeClientDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t1");
      m.set("title", "first");
      arr.push([m]);
    });
    await syncTemplateDoc.run(createTestContext(db), {
      userId,
      clientStateVector: emptyStateVector(),
      clientUpdate: a.update,
    });

    // 2 回目: 別 client が t2 を追加 (既存 state の update は持たない想定)
    const b = makeClientDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "t2");
      m.set("title", "second");
      arr.push([m]);
    });
    const result = await syncTemplateDoc.run(createTestContext(db), {
      userId,
      clientStateVector: emptyStateVector(),
      clientUpdate: b.update,
    });
    expect(result.ok).toBe(true);

    // 最終 state に t1 と t2 が両方入っている
    const stored = await createTemplateDocRepo().get(
      createDbWriteCtx(db),
      TemplateDoc.ByUserId(userId),
    );
    const doc = new Y.Doc();
    if (stored) Y.applyUpdate(doc, stored.state);
    const templates = doc.getArray<Y.Map<unknown>>("templates");
    expect(templates.length).toBe(2);
    const titles = new Set<unknown>();
    for (let i = 0; i < templates.length; i++) {
      titles.add(templates.get(i).get("title"));
    }
    expect(titles.has("first")).toBe(true);
    expect(titles.has("second")).toBe(true);
  });

  test("rejects oversized update and does not persist", async () => {
    const result = await syncTemplateDoc.run(createTestContext(db), {
      userId,
      clientStateVector: emptyStateVector(),
      clientUpdate: new Uint8Array(SYNC_LIMITS.MAX_UPDATE_BYTES + 1),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPDATE_TOO_LARGE");

    const stored = await createTemplateDocRepo().get(
      createDbWriteCtx(db),
      TemplateDoc.ByUserId(userId),
    );
    expect(stored).toBeNull();
  });

  test("concurrent first-writes serialize and both updates survive", async () => {
    // 2 つの client が同時に first push → FOR UPDATE 単独では row 不在で
    // 素通りするが、lockByUserId の advisory lock で直列化される。
    const a = makeClientDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "a1");
      m.set("title", "A");
      arr.push([m]);
    });
    const b = makeClientDoc((doc) => {
      const arr = doc.getArray<Y.Map<unknown>>("templates");
      const m = new Y.Map<unknown>();
      m.set("id", "b1");
      m.set("title", "B");
      arr.push([m]);
    });

    const ctx = createTestContext(db);
    const [r1, r2] = await Promise.all([
      syncTemplateDoc.run(ctx, {
        userId,
        clientStateVector: emptyStateVector(),
        clientUpdate: a.update,
      }),
      syncTemplateDoc.run(ctx, {
        userId,
        clientStateVector: emptyStateVector(),
        clientUpdate: b.update,
      }),
    ]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const stored = await createTemplateDocRepo().get(
      createDbWriteCtx(db),
      TemplateDoc.ByUserId(userId),
    );
    const doc = new Y.Doc();
    if (stored) Y.applyUpdate(doc, stored.state);
    const templates = doc.getArray<Y.Map<unknown>>("templates");
    expect(templates.length).toBe(2);
    const titles = new Set<unknown>();
    for (let i = 0; i < templates.length; i++) {
      titles.add(templates.get(i).get("title"));
    }
    expect(titles.has("A")).toBe(true);
    expect(titles.has("B")).toBe(true);
  });

  test("rejects update that creates a disallowed top-level key", async () => {
    const { update } = makeClientDoc((doc) => {
      doc.getMap("evil").set("x", "y");
    });

    const result = await syncTemplateDoc.run(createTestContext(db), {
      userId,
      clientStateVector: emptyStateVector(),
      clientUpdate: update,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_DOC_SHAPE");

    const stored = await createTemplateDocRepo().get(
      createDbWriteCtx(db),
      TemplateDoc.ByUserId(userId),
    );
    expect(stored).toBeNull();
  });
});
