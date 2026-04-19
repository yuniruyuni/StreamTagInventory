import { beforeEach, describe, expect, test } from "bun:test";
import { createTestSession, createTestUser } from "@test/factories";
import { createTestContext } from "@test/helpers/context";
import { createTestDB } from "@test/helpers/db";
import { Hono } from "hono";
import type { Database } from "@/infra/db/database";
import { Token } from "@/models/common";
import { createDbWriteCtx } from "@/repositories/common";
import { createDefault as createSessionRepo } from "@/repositories/session";
import { createDefault as createUserRepo } from "@/repositories/user";
import type { SessionContext, UserContext } from "@/usecases/context";
import { createSessionMiddleware } from "./session";

let db: Database;

beforeEach(async () => {
  db = await createTestDB();
});

function buildApp() {
  const app = new Hono();
  const ctx = createTestContext(db);
  app.use("*", createSessionMiddleware({ ctx }));
  app.get("/", (c) => {
    const session = c.get("session") as SessionContext | undefined;
    const user = c.get("user") as UserContext | undefined;
    return c.json({
      hasSession: session !== undefined,
      hasUser: user !== undefined,
      userId: user?.id ?? null,
    });
  });
  return app;
}

async function seedActiveSession(userId: string, rawToken: Token) {
  const session = createTestSession({ userId, tokenHash: rawToken.hash() });
  await createSessionRepo().upsert(createDbWriteCtx(db), session);
  return session;
}

describe("sessionMiddleware (Bearer)", () => {
  test("no Authorization header → ctx has no session/user", async () => {
    const res = await buildApp().request("/");
    const body = (await res.json()) as {
      hasSession: boolean;
      hasUser: boolean;
    };
    expect(body.hasSession).toBe(false);
    expect(body.hasUser).toBe(false);
  });

  test("valid Bearer token → ctx has session/user", async () => {
    const user = createTestUser();
    await createUserRepo().upsert(createDbWriteCtx(db), user);
    const raw = Token.generate();
    await seedActiveSession(user.id, raw);

    const res = await buildApp().request("/", {
      headers: { authorization: `Bearer ${raw.toBase64url()}` },
    });
    const body = (await res.json()) as {
      hasSession: boolean;
      hasUser: boolean;
      userId: string | null;
    };
    expect(body.hasSession).toBe(true);
    expect(body.hasUser).toBe(true);
    expect(body.userId).toBe(user.id);
  });

  test("Bearer with wrong token → ctx has no session", async () => {
    const user = createTestUser();
    await createUserRepo().upsert(createDbWriteCtx(db), user);
    await seedActiveSession(user.id, Token.generate());

    const res = await buildApp().request("/", {
      headers: {
        authorization: `Bearer ${Token.generate().toBase64url()}`,
      },
    });
    const body = (await res.json()) as { hasSession: boolean };
    expect(body.hasSession).toBe(false);
  });

  test("expired session → ctx has no session", async () => {
    const user = createTestUser();
    await createUserRepo().upsert(createDbWriteCtx(db), user);
    const raw = Token.generate();
    const expired = createTestSession({
      userId: user.id,
      tokenHash: raw.hash(),
      expiresAt: new Date(Date.now() - 60_000),
    });
    await createSessionRepo().upsert(createDbWriteCtx(db), expired);

    const res = await buildApp().request("/", {
      headers: { authorization: `Bearer ${raw.toBase64url()}` },
    });
    const body = (await res.json()) as { hasSession: boolean };
    expect(body.hasSession).toBe(false);
  });

  test("malformed Authorization header → ctx has no session", async () => {
    const res = await buildApp().request("/", {
      headers: { authorization: "NotBearer abc" },
    });
    const body = (await res.json()) as { hasSession: boolean };
    expect(body.hasSession).toBe(false);
  });
});
