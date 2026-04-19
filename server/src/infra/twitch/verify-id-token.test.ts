import { beforeAll, describe, expect, test } from "bun:test";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
  type JWTVerifyGetKey,
  type KeyLike,
  SignJWT,
} from "jose";
import { verifyIdToken } from "@/infra/twitch/verify-id-token";

const ISSUER = "https://id.twitch.tv/oauth2";
const AUDIENCE = "test-client-id";
const NONCE = "test-nonce-abc";
const SUB = "12345678";
const KID = "test-key-1";

let privateKey: KeyLike;
let publicJwk: JWK;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const pub = await exportJWK(pair.publicKey);
  pub.alg = "RS256";
  pub.use = "sig";
  pub.kid = KID;
  publicJwk = pub;
  jwks = createLocalJWKSet({ keys: [publicJwk] });
});

interface SignOverrides {
  iss?: string;
  aud?: string;
  sub?: string | null;
  nonce?: string | null;
  expDelta?: number; // seconds from now; negative => expired
  omitKid?: boolean;
}

async function signToken(overrides: SignOverrides = {}): Promise<string> {
  const expDelta = overrides.expDelta ?? 300;
  const builder = new SignJWT({
    ...(overrides.nonce !== null && { nonce: overrides.nonce ?? NONCE }),
    preferred_username: "test_user",
  })
    .setProtectedHeader({
      alg: "RS256",
      ...(overrides.omitKid ? {} : { kid: KID }),
    })
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${expDelta}s`);
  if (overrides.sub !== null) {
    builder.setSubject(overrides.sub ?? SUB);
  }
  return builder.sign(privateKey);
}

describe("verifyIdToken", () => {
  test("accepts a well-formed token and returns claims", async () => {
    const token = await signToken();
    const result = await verifyIdToken(token, jwks, {
      expectedAudience: AUDIENCE,
      expectedNonce: NONCE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sub).toBe(SUB);
    expect(result.value.aud).toBe(AUDIENCE);
    expect(result.value.iss).toBe(ISSUER);
    expect(result.value.preferred_username).toBe("test_user");
  });

  test("rejects a token with a tampered signature", async () => {
    const token = await signToken();
    const parts = token.split(".");
    // signature 部をゼロ埋めして確実に検証失敗させる (base64url 偶然一致を避ける)
    const tampered = `${parts[0]}.${parts[1]}.${"A".repeat(parts[2].length)}`;
    const result = await verifyIdToken(tampered, jwks, {
      expectedAudience: AUDIENCE,
      expectedNonce: NONCE,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects an expired token", async () => {
    const token = await signToken({ expDelta: -60 });
    const result = await verifyIdToken(token, jwks, {
      expectedAudience: AUDIENCE,
      expectedNonce: NONCE,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects a token with wrong issuer", async () => {
    const token = await signToken({ iss: "https://evil.example.com" });
    const result = await verifyIdToken(token, jwks, {
      expectedAudience: AUDIENCE,
      expectedNonce: NONCE,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects a token with wrong audience", async () => {
    const token = await signToken({ aud: "someone-elses-client-id" });
    const result = await verifyIdToken(token, jwks, {
      expectedAudience: AUDIENCE,
      expectedNonce: NONCE,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects a token whose nonce does not match expectedNonce", async () => {
    const token = await signToken({ nonce: "different-nonce" });
    const result = await verifyIdToken(token, jwks, {
      expectedAudience: AUDIENCE,
      expectedNonce: NONCE,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("nonce");
  });

  test("rejects a token missing sub", async () => {
    const token = await signToken({ sub: null });
    const result = await verifyIdToken(token, jwks, {
      expectedAudience: AUDIENCE,
      expectedNonce: NONCE,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("sub");
  });
});
