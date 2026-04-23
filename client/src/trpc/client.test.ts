import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ID_TOKEN_STORAGE_KEY, readIdToken } from "./client";

describe("readIdToken", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  test("returns null when no token in storage", () => {
    expect(readIdToken()).toBeNull();
  });

  test("returns the token string when useSession-format JSON is stored", () => {
    // useSession は JSON.stringify で書き込むため、文字列値は二重引用符付きで入る
    sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify("ey.token"));
    expect(readIdToken()).toBe("ey.token");
  });

  test("returns null when storage value is empty string (JSON-stringified)", () => {
    sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(""));
    expect(readIdToken()).toBeNull();
  });

  test("returns null when storage value is invalid JSON", () => {
    sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, "not-a-json{");
    expect(readIdToken()).toBeNull();
  });

  test("returns null when storage value parses to non-string (e.g., number)", () => {
    sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(42));
    expect(readIdToken()).toBeNull();
  });

  test("returns null when storage value parses to null", () => {
    sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(null));
    expect(readIdToken()).toBeNull();
  });

  test("reads synchronously (fetch 発行タイミングと独立)", () => {
    // 本 fix の意図: headers() が fetch 発行のたびに同期的に最新値を取れること。
    // setItem 直後に readIdToken を呼べば新値が見える (useEffect 等を挟まない)。
    sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify("first"));
    expect(readIdToken()).toBe("first");
    sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify("second"));
    expect(readIdToken()).toBe("second");
    sessionStorage.removeItem(ID_TOKEN_STORAGE_KEY);
    expect(readIdToken()).toBeNull();
  });
});
