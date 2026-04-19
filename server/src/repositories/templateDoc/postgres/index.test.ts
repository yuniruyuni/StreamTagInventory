import { beforeEach, describe, expect, test } from "bun:test";
import {
  createTestTemplateDoc,
  generateTestTwitchUserId,
} from "@test/factories";
import { createTestDB } from "@test/helpers/db";
import type { Database } from "@/infra/db/database";
import { TemplateDoc } from "@/models/templateDoc";
import {
  createDbReadCtx,
  createDbWriteCtx,
  type DbReadCtx,
  type DbWriteCtx,
} from "@/repositories/common";
import { createDefault, type TemplateDocRepository } from "..";

let db: Database;
let repo: TemplateDocRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;
let userId: string;

beforeEach(async () => {
  db = await createTestDB();
  repo = createDefault();
  rCtx = createDbReadCtx(db);
  wCtx = createDbWriteCtx(db);

  // ADR 0007: template_docs.user_id は Twitch user id を直接 PK として持つ。
  // test ごとに衝突しない id を生成して使う。
  userId = generateTestTwitchUserId();
});

describe("TemplateDocRepository upsert + get", () => {
  test("inserts and retrieves by user id", async () => {
    const doc = createTestTemplateDoc({
      userId,
      state: new Uint8Array([10, 20, 30, 40]),
    });
    await repo.upsert(wCtx, doc);

    const retrieved = await repo.get(rCtx, TemplateDoc.ByUserId(userId));
    expect(retrieved).not.toBeNull();
    expect(retrieved?.userId).toBe(userId);
    expect(Array.from(retrieved?.state ?? [])).toEqual([10, 20, 30, 40]);
    expect(retrieved?.sizeBytes).toBe(4);
  });

  test("returns null for user without a doc", async () => {
    const retrieved = await repo.get(rCtx, TemplateDoc.ByUserId(userId));
    expect(retrieved).toBeNull();
  });

  test("upsert on same user_id replaces state and size_bytes", async () => {
    await repo.upsert(
      wCtx,
      createTestTemplateDoc({ userId, state: new Uint8Array([1, 2]) }),
    );

    const newState = new Uint8Array([9, 9, 9, 9, 9]);
    await repo.upsert(wCtx, createTestTemplateDoc({ userId, state: newState }));

    const retrieved = await repo.get(rCtx, TemplateDoc.ByUserId(userId));
    expect(Array.from(retrieved?.state ?? [])).toEqual([9, 9, 9, 9, 9]);
    expect(retrieved?.sizeBytes).toBe(5);
  });
});

describe("TemplateDocRepository delete", () => {
  test("delete(ByUserId) removes the row", async () => {
    await repo.upsert(wCtx, createTestTemplateDoc({ userId }));

    const deleted = await repo.delete(wCtx, TemplateDoc.ByUserId(userId));
    expect(deleted).toBe(1);
    expect(await repo.get(rCtx, TemplateDoc.ByUserId(userId))).toBeNull();
  });
});

describe("TemplateDocRepository FOR UPDATE serialization", () => {
  test("DbWriteCtx-based get holds FOR UPDATE row lock in a transaction", async () => {
    await repo.upsert(
      wCtx,
      createTestTemplateDoc({ userId, state: new Uint8Array([0]) }),
    );

    // Outer transaction: acquire row lock via DbWriteCtx.get, then sleep briefly.
    // A concurrent write transaction trying to update the same row must block
    // until the outer transaction commits.
    const timeline: string[] = [];

    const outer = db.transaction(async (tx) => {
      const txW = createDbWriteCtx(tx);
      timeline.push("outer:lock-begin");
      await repo.get(txW, TemplateDoc.ByUserId(userId));
      timeline.push("outer:locked");
      // Hold the lock for a short period
      await new Promise((r) => setTimeout(r, 200));
      await repo.upsert(txW, {
        userId,
        state: new Uint8Array([1]),
        sizeBytes: 1,
        updatedAt: new Date(),
      });
      timeline.push("outer:upsert-done");
    });

    // Kick the competing writer shortly after the outer locks
    const competing = new Promise<void>((resolve) => {
      setTimeout(async () => {
        await db.transaction(async (tx) => {
          const txW = createDbWriteCtx(tx);
          timeline.push("inner:upsert-attempt");
          await repo.upsert(txW, {
            userId,
            state: new Uint8Array([2]),
            sizeBytes: 1,
            updatedAt: new Date(),
          });
          timeline.push("inner:upsert-done");
        });
        resolve();
      }, 50);
    });

    await Promise.all([outer, competing]);

    // The competing writer must have been queued behind the outer transaction
    const outerDoneIdx = timeline.indexOf("outer:upsert-done");
    const innerDoneIdx = timeline.indexOf("inner:upsert-done");
    expect(outerDoneIdx).toBeGreaterThanOrEqual(0);
    expect(innerDoneIdx).toBeGreaterThan(outerDoneIdx);

    // Final state reflects the last writer (inner)
    const final = await repo.get(rCtx, TemplateDoc.ByUserId(userId));
    expect(Array.from(final?.state ?? [])).toEqual([2]);
  });

  test("DbReadCtx-based get does not acquire FOR UPDATE (plain SELECT)", async () => {
    await repo.upsert(wCtx, createTestTemplateDoc({ userId }));

    // Two concurrent read transactions should both complete quickly
    // (no row lock contention).
    const start = Date.now();
    await Promise.all([
      db.readTransaction(async (tx) => {
        await repo.get(createDbReadCtx(tx), TemplateDoc.ByUserId(userId));
        await new Promise((r) => setTimeout(r, 50));
      }),
      db.readTransaction(async (tx) => {
        await repo.get(createDbReadCtx(tx), TemplateDoc.ByUserId(userId));
      }),
    ]);
    const elapsed = Date.now() - start;
    // They ran in parallel, so total elapsed should be close to 50ms, not 100ms
    expect(elapsed).toBeLessThan(150);
  });
});
