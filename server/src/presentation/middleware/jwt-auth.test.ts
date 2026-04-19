import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createTestUser } from "@test/factories";
import { createTestContext } from "@test/helpers/context";
import { createTestDB } from "@test/helpers/db";
import { Hono } from "hono";
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
import { User } from "@/models/user";
import { createDbReadCtx, createDbWriteCtx } from "@/repositories/common";
import { createDefault as createUserRepo } from "@/repositories/user";
import type { UserContext } from "@/usecases/context";
import { createJwtAuthMiddleware } from "./jwt-auth";

const ISSUER = "https://id.twitch.tv/oauth2";
const AUDIENCE = "test-client-id";
const SUB = "987654321";
const KID = "test-key-jwt-auth";

let db: Database;
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

beforeEach(async () => {
  db = await createTestDB();
});

interface SignOpts {
  sub?: string;
  preferredUsername?: string;
  expDelta?: number;
}

async function signIdToken(opts: SignOpts = {}): Promise<string> {
  const builder = new SignJWT({
    nonce: "client-side-nonce-irrelevant-here",
    preferred_username: opts.preferredUsername ?? "twitchuser",
  })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${opts.expDelta ?? 300}s`)
    .setSubject(opts.sub ?? SUB);
  return builder.sign(privateKey);
}

function buildApp() {
  const ctx = createTestContext(db, {
    twitch: { clientId: AUDIENCE, jwks },
  });
  const app = new Hono();
  app.use("*", createJwtAuthMiddleware({ ctx }));
  app.get("/", (c) => {
    const user = c.get("user") as UserContext | undefined;
    return c.json({
      hasUser: user !== undefined,
      twitchUserId: user?.twitchUserId ?? null,
      login: user?.login ?? null,
    });
  });
  return { app, ctx };
}

describe("jwtAuthMiddleware (ADR 0007)", () => {
  test("no Authorization header → ctx has no user", async () => {
    const { app } = buildApp();
    const res = await app.request("/");
    const body = (await res.json()) as { hasUser: boolean };
    expect(body.hasUser).toBe(false);
  });

  test("malformed Authorization header → ctx has no user", async () => {
    const { app } = buildApp();
    const res = await app.request("/", {
      headers: { authorization: "NotBearer xyz" },
    });
    const body = (await res.json()) as { hasUser: boolean };
    expect(body.hasUser).toBe(false);
  });

  test("invalid jwt → ctx has no user", async () => {
    const { app } = buildApp();
    const res = await app.request("/", {
      headers: { authorization: "Bearer not.a.jwt" },
    });
    const body = (await res.json()) as { hasUser: boolean };
    expect(body.hasUser).toBe(false);
  });

  test("expired jwt → ctx has no user", async () => {
    const { app } = buildApp();
    const token = await signIdToken({ expDelta: -60 });
    const res = await app.request("/", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { hasUser: boolean };
    expect(body.hasUser).toBe(false);
  });

  test("valid jwt for new user → upserts user and sets ctx.user", async () => {
    const { app } = buildApp();
    const token = await signIdToken({ preferredUsername: "freshuser" });
    const res = await app.request("/", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      hasUser: boolean;
      twitchUserId: string | null;
      login: string | null;
    };
    expect(body.hasUser).toBe(true);
    expect(body.twitchUserId).toBe(SUB);
    expect(body.login).toBe("freshuser");

    // 実際に DB に行が出来ていること
    const stored = await createUserRepo().get(
      createDbReadCtx(db),
      User.ByTwitchUserId(SUB),
    );
    expect(stored?.twitchUserId).toBe(SUB);
    expect(stored?.login).toBe("freshuser");
  });

  test("valid jwt for existing user → reuses id and updates login", async () => {
    const existing = createTestUser({
      twitchUserId: SUB,
      login: "old_login",
      displayName: "Old Display",
    });
    await createUserRepo().upsert(createDbWriteCtx(db), existing);

    const { app } = buildApp();
    const token = await signIdToken({ preferredUsername: "new_login" });
    const res = await app.request("/", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      hasUser: boolean;
      twitchUserId: string | null;
      login: string | null;
    };
    expect(body.hasUser).toBe(true);
    expect(body.twitchUserId).toBe(SUB);
    expect(body.login).toBe("new_login");

    const stored = await createUserRepo().get(
      createDbReadCtx(db),
      User.ByTwitchUserId(SUB),
    );
    expect(stored?.id).toBe(existing.id);
    expect(stored?.login).toBe("new_login");
  });
});
