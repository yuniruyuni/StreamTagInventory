import { expect, test } from "bun:test";
import { clearHash, parseAuthFromHash } from "./utils";

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
