import { beforeEach, describe, expect, test } from "bun:test";
import { createTestOidcNonce } from "@test/factories";
import { createTestDB } from "@test/helpers/db";
import type { Database } from "@/infra/db/database";
import { and, Token } from "@/models/common";
import { OidcNonce } from "@/models/oidcNonce";
import {
  createDbReadCtx,
  createDbWriteCtx,
  type DbReadCtx,
  type DbWriteCtx,
} from "@/repositories/common";
import { createDefault, type OidcNonceRepository } from "..";

let db: Database;
let repo: OidcNonceRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;

beforeEach(async () => {
  db = await createTestDB();
  repo = createDefault();
  rCtx = createDbReadCtx(db);
  wCtx = createDbWriteCtx(db);
});

describe("OidcNonceRepository upsert + get", () => {
  test("inserts and retrieves a nonce", async () => {
    const nonce = createTestOidcNonce();
    await repo.upsert(wCtx, nonce);

    const retrieved = await repo.get(rCtx, OidcNonce.ByValue(nonce.nonce));
    expect(retrieved).not.toBeNull();
    expect(retrieved?.nonce.equals(nonce.nonce)).toBe(true);
  });

  test("returns null for non-existent nonce", async () => {
    const retrieved = await repo.get(rCtx, OidcNonce.ByValue(Token.generate()));
    expect(retrieved).toBeNull();
  });
});

describe("OidcNonceRepository atomic consume pattern", () => {
  test("delete(ByValue AND ActiveAt(now)) is the atomic consume", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60_000);
    const fresh = Token.generate();
    const nonce = createTestOidcNonce({ nonce: fresh, expiresAt: future });
    await repo.upsert(wCtx, nonce);

    const deleted = await repo.delete(
      wCtx,
      and(OidcNonce.ByValue(fresh), OidcNonce.ActiveAt(now)),
    );
    expect(deleted).toBe(1);
    expect(await repo.get(rCtx, OidcNonce.ByValue(fresh))).toBeNull();
  });

  test("consume skips expired nonce (rowCount = 0)", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60_000);
    const stale = Token.generate();
    const nonce = createTestOidcNonce({ nonce: stale, expiresAt: past });
    await repo.upsert(wCtx, nonce);

    const deleted = await repo.delete(
      wCtx,
      and(OidcNonce.ByValue(stale), OidcNonce.ActiveAt(now)),
    );
    expect(deleted).toBe(0);
    // The expired row still exists (cleanup is separate)
    expect(await repo.get(rCtx, OidcNonce.ByValue(stale))).not.toBeNull();
  });

  test("ExpiredAt(now) cleanup removes only past-expired rows", async () => {
    const now = new Date();
    const freshToken = Token.generate();
    const staleToken = Token.generate();
    const fresh = createTestOidcNonce({
      nonce: freshToken,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const stale = createTestOidcNonce({
      nonce: staleToken,
      expiresAt: new Date(now.getTime() - 60_000),
    });
    await repo.upsert(wCtx, fresh);
    await repo.upsert(wCtx, stale);

    const deleted = await repo.delete(wCtx, OidcNonce.ExpiredAt(now));
    expect(deleted).toBe(1);
    expect(await repo.get(rCtx, OidcNonce.ByValue(freshToken))).not.toBeNull();
    expect(await repo.get(rCtx, OidcNonce.ByValue(staleToken))).toBeNull();
  });
});
