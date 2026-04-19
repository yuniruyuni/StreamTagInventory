import { beforeEach, describe, expect, test } from "bun:test";
import { createTestSession, createTestUser } from "@test/factories";
import { createTestContext } from "@test/helpers/context";
import { createTestDB } from "@test/helpers/db";
import type { Database } from "@/infra/db/database";
import { Session } from "@/models/session";
import { createDbWriteCtx } from "@/repositories/common";
import { createDefault as createSessionRepo } from "@/repositories/session";
import { createDefault as createUserRepo } from "@/repositories/user";
import { logout } from "@/usecases/auth/logout";

let db: Database;

beforeEach(async () => {
  db = await createTestDB();
});

describe("logout", () => {
  test("removes the session row and returns ok", async () => {
    const user = createTestUser();
    await createUserRepo().upsert(createDbWriteCtx(db), user);
    const session = createTestSession({ userId: user.id });
    await createSessionRepo().upsert(createDbWriteCtx(db), session);

    const result = await logout.run(createTestContext(db), {
      sessionId: session.id,
    });
    expect(result.ok).toBe(true);

    const remaining = await createSessionRepo().get(
      createDbWriteCtx(db),
      Session.ById(session.id),
    );
    expect(remaining).toBeNull();
  });

  test("is idempotent for non-existent sessions", async () => {
    const result = await logout.run(createTestContext(db), {
      sessionId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.ok).toBe(true);
  });
});
