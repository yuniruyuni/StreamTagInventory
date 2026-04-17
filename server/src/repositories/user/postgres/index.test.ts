import { beforeEach, describe, expect, test } from "bun:test";
import { createTestUser } from "@test/factories";
import { createTestDB } from "@test/helpers/db";
import type { Database } from "@/infra/db/database";
import { User } from "@/models/user";
import {
  createDbReadCtx,
  createDbWriteCtx,
  type DbReadCtx,
  type DbWriteCtx,
} from "@/repositories/common";
import { createDefault, type UserRepository } from "..";

let db: Database;
let repo: UserRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;

beforeEach(async () => {
  db = await createTestDB();
  repo = createDefault();
  rCtx = createDbReadCtx(db);
  wCtx = createDbWriteCtx(db);
});

describe("UserRepository upsert + get", () => {
  test("inserts and retrieves by id", async () => {
    const user = createTestUser();
    await repo.upsert(wCtx, user);

    const retrieved = await repo.get(rCtx, User.ById(user.id));
    expect(retrieved).not.toBeNull();
    expect(retrieved?.twitchUserId).toBe(user.twitchUserId);
    expect(retrieved?.login).toBe(user.login);
  });

  test("returns null for non-existent id", async () => {
    const retrieved = await repo.get(
      rCtx,
      User.ById("00000000-0000-0000-0000-000000000000"),
    );
    expect(retrieved).toBeNull();
  });

  test("ByTwitchUserId retrieves by twitch_user_id", async () => {
    const user = createTestUser({ twitchUserId: "twitch-unique-1" });
    await repo.upsert(wCtx, user);

    const retrieved = await repo.get(
      rCtx,
      User.ByTwitchUserId("twitch-unique-1"),
    );
    expect(retrieved?.id).toBe(user.id);
  });

  test("upsert on same twitch_user_id updates login/display_name/last_login_at", async () => {
    const first = createTestUser({ twitchUserId: "twitch-reup" });
    await repo.upsert(wCtx, first);

    const later = new Date(first.lastLoginAt.getTime() + 60_000);
    const updated: User = {
      ...first,
      login: "new_login",
      displayName: "New Name",
      updatedAt: later,
      lastLoginAt: later,
    };
    await repo.upsert(wCtx, updated);

    const retrieved = await repo.get(rCtx, User.ByTwitchUserId("twitch-reup"));
    expect(retrieved?.login).toBe("new_login");
    expect(retrieved?.displayName).toBe("New Name");
    expect(retrieved?.lastLoginAt.getTime()).toBe(later.getTime());
  });
});

describe("UserRepository list + count", () => {
  test("count matches upserted rows with same twitch_user_id prefix", async () => {
    const u1 = createTestUser({ twitchUserId: "twitch-a" });
    const u2 = createTestUser({ twitchUserId: "twitch-b" });
    await repo.upsert(wCtx, u1);
    await repo.upsert(wCtx, u2);

    expect(await repo.count(rCtx, User.ById(u1.id))).toBe(1);
    expect(await repo.count(rCtx, User.ById(u2.id))).toBe(1);
    expect(
      await repo.count(rCtx, User.ById("00000000-0000-0000-0000-000000000000")),
    ).toBe(0);
  });

  test("list returns a single-item page for ById", async () => {
    const user = createTestUser();
    await repo.upsert(wCtx, user);

    const page = await repo.list(rCtx, User.ById(user.id), { limit: 50 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe(user.id);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });

  test("list with limit smaller than result set reports hasMore", async () => {
    const u1 = createTestUser({ twitchUserId: "twitch-page-1" });
    const u2 = createTestUser({ twitchUserId: "twitch-page-2" });
    await repo.upsert(wCtx, u1);
    await repo.upsert(wCtx, u2);

    // AND-OR compose an "ANY of (ById u1) OR (ById u2)" spec
    const spec = User.ById(u1.id).or(User.ById(u2.id));
    const page = await repo.list(rCtx, spec, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeDefined();
  });
});

describe("UserRepository delete", () => {
  test("removes the row and returns rowCount", async () => {
    const user = createTestUser();
    await repo.upsert(wCtx, user);

    const deleted = await repo.delete(wCtx, User.ById(user.id));
    expect(deleted).toBe(1);
    expect(await repo.get(rCtx, User.ById(user.id))).toBeNull();
  });

  test("returns 0 for non-existent id", async () => {
    const deleted = await repo.delete(
      wCtx,
      User.ById("00000000-0000-0000-0000-000000000000"),
    );
    expect(deleted).toBe(0);
  });
});
