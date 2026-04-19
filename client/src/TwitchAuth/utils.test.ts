import { expect, test } from "bun:test";
import {
  clearHash,
  generateNonce,
  parseAuthFromHash,
  peekIdTokenNonce,
} from "./utils";

test("parseAuthFromHash extracts access_token and id_token", () => {
  const orig = window.location.hash;
  window.location.hash =
    "#access_token=at&id_token=it&token_type=bearer&expires_in=3600";
  const result = parseAuthFromHash();
  expect(result).toEqual({ accessToken: "at", idToken: "it" });
  window.location.hash = orig;
});

test("parseAuthFromHash returns null when access_token is missing", () => {
  const orig = window.location.hash;
  window.location.hash = "#id_token=it";
  expect(parseAuthFromHash()).toBeNull();
  window.location.hash = orig;
});

test("parseAuthFromHash returns null when id_token is missing", () => {
  const orig = window.location.hash;
  window.location.hash = "#access_token=at";
  expect(parseAuthFromHash()).toBeNull();
  window.location.hash = orig;
});

test("parseAuthFromHash returns null for empty hash", () => {
  const orig = window.location.hash;
  window.location.hash = "";
  expect(parseAuthFromHash()).toBeNull();
  window.location.hash = orig;
});

test("clearHash removes the URL fragment", () => {
  const orig = window.location.hash;
  window.location.hash = "#some-hash";
  expect(window.location.hash).toBe("#some-hash");
  clearHash();
  expect(window.location.hash).toBe("");
  window.location.hash = orig;
});

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "RS256", kid: "x" }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.signature-not-verified`;
}

test("peekIdTokenNonce extracts nonce claim from a well-formed JWT", () => {
  const jwt = makeFakeJwt({ sub: "1", nonce: "abc-123" });
  expect(peekIdTokenNonce(jwt)).toBe("abc-123");
});

test("peekIdTokenNonce returns null when nonce claim is missing", () => {
  const jwt = makeFakeJwt({ sub: "1" });
  expect(peekIdTokenNonce(jwt)).toBeNull();
});

test("peekIdTokenNonce returns null when nonce is not a string", () => {
  const jwt = makeFakeJwt({ sub: "1", nonce: 42 });
  expect(peekIdTokenNonce(jwt)).toBeNull();
});

test("peekIdTokenNonce returns null for a malformed token", () => {
  expect(peekIdTokenNonce("not.a.jwt.at.all")).toBeNull();
  expect(peekIdTokenNonce("only-one-segment")).toBeNull();
  expect(peekIdTokenNonce("a.bad-base64?.c")).toBeNull();
});

test("generateNonce returns a non-empty unique string", () => {
  const a = generateNonce();
  const b = generateNonce();
  expect(a.length).toBeGreaterThan(0);
  expect(a).not.toBe(b);
});
