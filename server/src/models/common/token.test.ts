import { describe, expect, test } from "bun:test";
import { Token } from "./token";

describe("Token", () => {
  test("generate produces 43-char base64url (32 bytes of entropy)", () => {
    const t = Token.generate();
    expect(t.toBase64url()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("fromBase64url round-trips canonical value", () => {
    const a = Token.generate();
    const b = Token.fromBase64url(a.toBase64url());
    expect(b.toBase64url()).toBe(a.toBase64url());
  });

  test("equals is true for same token, false for different", () => {
    const a = Token.generate();
    const aCopy = Token.fromBase64url(a.toBase64url());
    const b = Token.generate();
    expect(a.equals(aCopy)).toBe(true);
    expect(a.equals(b)).toBe(false);
  });

  test("hash returns 43-char base64url and is deterministic", () => {
    const t = Token.generate();
    const h1 = t.hash();
    const h2 = t.hash();
    expect(h1).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(h1).toBe(h2);
  });

  test("hash differs for different tokens", () => {
    const a = Token.generate();
    const b = Token.generate();
    expect(a.hash()).not.toBe(b.hash());
  });

  test("hash is stable across round-trip via base64url", () => {
    const a = Token.generate();
    const reconstructed = Token.fromBase64url(a.toBase64url());
    expect(reconstructed.hash()).toBe(a.hash());
  });
});
