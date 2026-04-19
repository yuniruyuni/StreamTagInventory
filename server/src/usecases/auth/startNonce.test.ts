import { beforeEach, describe, expect, test } from "bun:test";
import { createTestContext } from "@test/helpers/context";
import { createTestDB } from "@test/helpers/db";
import type { Database } from "@/infra/db/database";
import { OidcNonce } from "@/models/oidcNonce";
import { createDbWriteCtx } from "@/repositories/common";
import { createDefault as createOidcNonceRepo } from "@/repositories/oidcNonce";
import { startNonce } from "@/usecases/auth/startNonce";

let db: Database;

beforeEach(async () => {
  db = await createTestDB();
});

describe("startNonce", () => {
  test("persists a random 32-byte nonce with ~10 minute expiry", async () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const result = await startNonce.run(createTestContext(db, { now }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 32 bytes = 256 bits of entropy. base64url no-padding で 43 文字。
    expect(result.value.nonce.toBase64url()).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const saved = await createOidcNonceRepo().get(
      createDbWriteCtx(db),
      OidcNonce.ByValue(result.value.nonce),
    );
    expect(saved).not.toBeNull();
    if (!saved) return;
    const ttl = saved.expiresAt.getTime() - now.getTime();
    expect(ttl).toBe(10 * 60 * 1000);
    // DB round-trip 後も同じ Token として等価 (timing-safe)
    expect(saved.nonce.equals(result.value.nonce)).toBe(true);
  });

  test("each call produces a unique nonce", async () => {
    const ctx = createTestContext(db);
    const r1 = await startNonce.run(ctx);
    const r2 = await startNonce.run(ctx);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.value.nonce.equals(r2.value.nonce)).toBe(false);
    }
  });
});
