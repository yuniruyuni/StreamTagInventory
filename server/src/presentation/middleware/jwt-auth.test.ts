import { beforeAll, describe, expect, test } from "bun:test";
import { createTestContext } from "@test/helpers/context";
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
import type { UserContext } from "@/usecases/context";
import { createJwtAuthMiddleware } from "./jwt-auth";

const ISSUER = "https://id.twitch.tv/oauth2";
const AUDIENCE = "test-client-id";
const SUB = "987654321";
const KID = "test-key-jwt-auth";

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
  // ADR 0007: middleware は DB I/O を行わないので test では db を使わない。
  // createTestContext は db を要求するが渡した値は middleware からは参照されない。
  const ctx = createTestContext(
    // biome-ignore lint/suspicious/noExplicitAny: dummy db not accessed by jwt-auth
    null as any,
    { twitch: { clientId: AUDIENCE, jwks } },
  );
  const app = new Hono();
  app.use("*", createJwtAuthMiddleware({ ctx }));
  app.get("/", (c) => {
    const user = c.get("user") as UserContext | undefined;
    return c.json({
      hasUser: user !== undefined,
      id: user?.id ?? null,
      twitchUserId: user?.twitchUserId ?? null,
      login: user?.login ?? null,
    });
  });
  return app;
}

describe("jwtAuthMiddleware (ADR 0007)", () => {
  test("no Authorization header → ctx has no user", async () => {
    const res = await buildApp().request("/");
    const body = (await res.json()) as { hasUser: boolean };
    expect(body.hasUser).toBe(false);
  });

  test("malformed Authorization header → ctx has no user", async () => {
    const res = await buildApp().request("/", {
      headers: { authorization: "NotBearer xyz" },
    });
    const body = (await res.json()) as { hasUser: boolean };
    expect(body.hasUser).toBe(false);
  });

  test("invalid jwt → ctx has no user", async () => {
    const res = await buildApp().request("/", {
      headers: { authorization: "Bearer not.a.jwt" },
    });
    const body = (await res.json()) as { hasUser: boolean };
    expect(body.hasUser).toBe(false);
  });

  test("expired jwt → ctx has no user", async () => {
    const token = await signIdToken({ expDelta: -60 });
    const res = await buildApp().request("/", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { hasUser: boolean };
    expect(body.hasUser).toBe(false);
  });

  test("valid jwt → ctx.user.id is Twitch user id (sub)", async () => {
    const token = await signIdToken({ preferredUsername: "freshuser" });
    const res = await buildApp().request("/", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      hasUser: boolean;
      id: string | null;
      twitchUserId: string | null;
      login: string | null;
    };
    expect(body.hasUser).toBe(true);
    expect(body.id).toBe(SUB);
    expect(body.twitchUserId).toBe(SUB);
    expect(body.login).toBe("freshuser");
  });

  test("valid jwt without preferred_username → login is empty string", async () => {
    // preferred_username を省いた signing で signIdToken を作り直す
    const builder = new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("300s")
      .setSubject(SUB);
    const token = await builder.sign(privateKey);

    const res = await buildApp().request("/", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      hasUser: boolean;
      login: string | null;
    };
    expect(body.hasUser).toBe(true);
    expect(body.login).toBe("");
  });
});
