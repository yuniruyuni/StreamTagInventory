import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createTestContext } from "@test/helpers/context";
import { createTestDB } from "@test/helpers/db";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
  type JWTVerifyGetKey,
  type KeyLike,
  SignJWT,
} from "jose";
import type { Database } from "@/infra/db/database";
import { Token } from "@/models/common";
import { OidcNonce } from "@/models/oidcNonce";
import { Session } from "@/models/session";
import { User } from "@/models/user";
import { createDbWriteCtx } from "@/repositories/common";
import { createDefault as createOidcNonceRepo } from "@/repositories/oidcNonce";
import { createDefault as createSessionRepo } from "@/repositories/session";
import { createDefault as createUserRepo } from "@/repositories/user";
import { login } from "@/usecases/auth/login";

const ISSUER = "https://id.twitch.tv/oauth2";
const CLIENT_ID = "test-client-id";
const SUB = "twitch-user-77";
const KID = "test-key";

let privateKey: KeyLike;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const pub: JWK = await exportJWK(pair.publicKey);
  pub.alg = "RS256";
  pub.use = "sig";
  pub.kid = KID;
  jwks = createLocalJWKSet({ keys: [pub] });
});

interface SignOverrides {
  sub?: string;
  nonce?: string;
  preferred_username?: string;
  expDelta?: number;
}

async function signToken(overrides: SignOverrides = {}): Promise<string> {
  return new SignJWT({
    nonce: overrides.nonce ?? "test-nonce",
    preferred_username: overrides.preferred_username ?? "test_user",
  })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(ISSUER)
    .setAudience(CLIENT_ID)
    .setSubject(overrides.sub ?? SUB)
    .setIssuedAt()
    .setExpirationTime(`${overrides.expDelta ?? 300}s`)
    .sign(privateKey);
}

let db: Database;

beforeEach(async () => {
  db = await createTestDB();
});

function makeCtx(now?: Date) {
  return createTestContext(db, {
    now,
    twitch: { clientId: CLIENT_ID, jwks },
  });
}

async function seedNonce(nonceValue: string, expiresAt: Date): Promise<void> {
  const now = new Date();
  const repo = createOidcNonceRepo();
  await repo.upsert(
    createDbWriteCtx(db),
    OidcNonce.create({
      nonce: Token.fromBase64url(nonceValue),
      expiresAt,
      now,
    }),
  );
}

describe("loginUsecase", () => {
  test("creates user + session for a fresh Twitch identity", async () => {
    const now = new Date();
    await seedNonce("fresh-nonce", new Date(now.getTime() + 5 * 60_000));
    const idToken = await signToken({ nonce: "fresh-nonce" });

    const result = await login.run(makeCtx(now), {
      idToken,
      nonce: "fresh-nonce",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.twitchUserId).toBe(SUB);
    expect(result.value.user.login).toBe("test_user");
    // csrfToken は 32 bytes 相当 (base64url no-padding で 43 文字)
    expect(result.value.session.csrfToken.toBase64url()).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(result.value.session.expiresAt.getTime()).toBeGreaterThan(
      now.getTime(),
    );
    expect(result.value.session.userId).toBe(result.value.user.id);

    // nonce is consumed
    const consumed = await createOidcNonceRepo().get(
      createDbWriteCtx(db),
      OidcNonce.ByValue(Token.fromBase64url("fresh-nonce")),
    );
    expect(consumed).toBeNull();

    // session persisted
    const persisted = await createSessionRepo().get(
      createDbWriteCtx(db),
      Session.ById(result.value.session.id),
    );
    expect(persisted?.userId).toBe(result.value.user.id);
  });

  test("reuses existing user on repeat login (same twitch_user_id)", async () => {
    const now = new Date();
    await seedNonce("nonce-1", new Date(now.getTime() + 5 * 60_000));
    const firstLogin = await login.run(makeCtx(now), {
      idToken: await signToken({ nonce: "nonce-1" }),
      nonce: "nonce-1",
    });
    expect(firstLogin.ok).toBe(true);
    if (!firstLogin.ok) return;
    const firstUserId = firstLogin.value.user.id;

    await seedNonce("nonce-2", new Date(now.getTime() + 5 * 60_000));
    const secondLogin = await login.run(makeCtx(now), {
      idToken: await signToken({
        nonce: "nonce-2",
        preferred_username: "renamed_user",
      }),
      nonce: "nonce-2",
    });
    expect(secondLogin.ok).toBe(true);
    if (!secondLogin.ok) return;

    expect(secondLogin.value.user.id).toBe(firstUserId);
    expect(secondLogin.value.user.login).toBe("renamed_user");
    // distinct session
    expect(secondLogin.value.session.id).not.toBe(firstLogin.value.session.id);
    // both users count = 1
    const count = await createUserRepo().count(
      createDbWriteCtx(db),
      User.ByTwitchUserId(SUB),
    );
    expect(count).toBe(1);
  });

  test("fails when nonce is unknown (not seeded)", async () => {
    const idToken = await signToken({ nonce: "never-issued" });
    const result = await login.run(makeCtx(), {
      idToken,
      nonce: "never-issued",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("nonce");
  });

  test("fails when nonce has already been consumed", async () => {
    const now = new Date();
    await seedNonce("used-nonce", new Date(now.getTime() + 5 * 60_000));
    const idToken = await signToken({ nonce: "used-nonce" });

    const first = await login.run(makeCtx(now), {
      idToken,
      nonce: "used-nonce",
    });
    expect(first.ok).toBe(true);

    // Same nonce reused — must fail (replay protection)
    const replay = await login.run(makeCtx(now), {
      idToken,
      nonce: "used-nonce",
    });
    expect(replay.ok).toBe(false);
  });

  test("fails when nonce is expired", async () => {
    const now = new Date();
    // Seed with already-expired timestamp
    await seedNonce("stale", new Date(now.getTime() - 60_000));
    const idToken = await signToken({ nonce: "stale" });

    const result = await login.run(makeCtx(now), {
      idToken,
      nonce: "stale",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("nonce");
  });

  test("fails when id_token nonce claim does not match expected", async () => {
    const now = new Date();
    await seedNonce("good-nonce", new Date(now.getTime() + 5 * 60_000));
    const idToken = await signToken({
      nonce: "mismatch", // signed with different nonce than expected
    });

    const result = await login.run(makeCtx(now), {
      idToken,
      nonce: "good-nonce",
    });
    expect(result.ok).toBe(false);

    // Fail の return は pg-client.ts で COMMIT 扱い (throw のみ rollback) なので
    // nonce DELETE は確定する。これにより同じ nonce の retry は "nonce is unknown"
    // で拒否される (replay 防止)。詳細は login.ts の コメント参照。
    const nonceAfter = await createOidcNonceRepo().get(
      createDbWriteCtx(db),
      OidcNonce.ByValue(Token.fromBase64url("good-nonce")),
    );
    expect(nonceAfter).toBeNull();
  });
});
