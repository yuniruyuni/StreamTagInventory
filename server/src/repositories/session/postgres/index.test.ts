import { beforeEach, describe, expect, test } from "bun:test";
import { createTestSession, createTestUser } from "@test/factories";
import { createTestDB } from "@test/helpers/db";
import type { Database } from "@/infra/db/database";
import { and } from "@/models/common";
import { Session } from "@/models/session";
import { User } from "@/models/user";
import {
  createDbReadCtx,
  createDbWriteCtx,
  type DbReadCtx,
  type DbWriteCtx,
} from "@/repositories/common";
import {
  createDefault as createUserRepo,
  type UserRepository,
} from "@/repositories/user";
import { createDefault, type SessionRepository } from "..";

let db: Database;
let sessionRepo: SessionRepository;
let userRepo: UserRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;
let userId: string;

beforeEach(async () => {
  db = await createTestDB();
  sessionRepo = createDefault();
  userRepo = createUserRepo();
  rCtx = createDbReadCtx(db);
  wCtx = createDbWriteCtx(db);

  const user = createTestUser();
  await userRepo.upsert(wCtx, user);
  userId = user.id;
});

describe("SessionRepository upsert + get", () => {
  test("inserts and retrieves by id", async () => {
    const session = createTestSession({ userId });
    await sessionRepo.upsert(wCtx, session);

    const retrieved = await sessionRepo.get(rCtx, Session.ById(session.id));
    expect(retrieved).not.toBeNull();
    expect(retrieved?.userId).toBe(userId);
    expect(retrieved?.csrfToken.equals(session.csrfToken)).toBe(true);
  });

  test("ByUserId retrieves the user's session", async () => {
    const session = createTestSession({ userId });
    await sessionRepo.upsert(wCtx, session);

    const retrieved = await sessionRepo.get(rCtx, Session.ByUserId(userId));
    expect(retrieved?.id).toBe(session.id);
  });

  test("upsert on same id updates last_seen_at", async () => {
    const session = createTestSession({ userId });
    await sessionRepo.upsert(wCtx, session);

    const later = new Date(session.lastSeenAt.getTime() + 60_000);
    await sessionRepo.upsert(wCtx, { ...session, lastSeenAt: later });

    const retrieved = await sessionRepo.get(rCtx, Session.ById(session.id));
    expect(retrieved?.lastSeenAt.getTime()).toBe(later.getTime());
  });
});

describe("SessionRepository ActiveAt / Expired specs", () => {
  test("ActiveAt(now) excludes sessions with expires_at <= now", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60_000);
    const past = new Date(now.getTime() - 60_000);

    const active = createTestSession({ userId, expiresAt: future });
    const expired = createTestSession({ userId, expiresAt: past });
    await sessionRepo.upsert(wCtx, active);
    await sessionRepo.upsert(wCtx, expired);

    expect(
      await sessionRepo.get(
        rCtx,
        and(Session.ById(active.id), Session.ActiveAt(now)),
      ),
    ).not.toBeNull();
    expect(
      await sessionRepo.get(
        rCtx,
        and(Session.ById(expired.id), Session.ActiveAt(now)),
      ),
    ).toBeNull();
  });

  test("Expired() matches sessions past expires_at (now())", async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const expired = createTestSession({ userId, expiresAt: past });
    const active = createTestSession({ userId, expiresAt: future });
    await sessionRepo.upsert(wCtx, expired);
    await sessionRepo.upsert(wCtx, active);

    expect(
      await sessionRepo.count(
        rCtx,
        and(Session.ByUserId(userId), Session.Expired()),
      ),
    ).toBe(1);
  });
});

describe("SessionRepository delete", () => {
  test("delete(ById) removes single row", async () => {
    const session = createTestSession({ userId });
    await sessionRepo.upsert(wCtx, session);

    const deleted = await sessionRepo.delete(wCtx, Session.ById(session.id));
    expect(deleted).toBe(1);
    expect(await sessionRepo.get(rCtx, Session.ById(session.id))).toBeNull();
  });

  test("user CASCADE delete removes the user's sessions", async () => {
    const session = createTestSession({ userId });
    await sessionRepo.upsert(wCtx, session);

    await userRepo.delete(wCtx, User.ById(userId));
    expect(await sessionRepo.count(rCtx, Session.ById(session.id))).toBe(0);
  });
});
