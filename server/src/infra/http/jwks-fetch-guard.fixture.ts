import "./install-fetch-guard";
import assert from "node:assert/strict";
import {
  createRemoteJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  SignJWT,
} from "jose";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "fixture", alg: "RS256" };
const token = await new SignJWT({ sub: "fixture" })
  .setProtectedHeader({ alg: "RS256", kid: "fixture" })
  .setExpirationTime("1m")
  .sign(privateKey);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    assert.equal(request.headers.get("accept-encoding"), "identity");
    if (new URL(request.url).pathname === "/br") {
      return new Response("invalid brotli fixture", {
        headers: { "Content-Encoding": "br" },
      });
    }
    return Response.json({ keys: [jwk] });
  },
});
try {
  assert.equal(
    (await jwtVerify(token, createRemoteJWKSet(server.url))).payload.sub,
    "fixture",
  );
  await assert.rejects(
    () => jwtVerify(token, createRemoteJWKSet(new URL("/br", server.url))),
    /Compressed HTTP responses are temporarily disabled/,
  );
  console.log("jose native global fetch JWKS guard passed");
} finally {
  server.stop(true);
}
