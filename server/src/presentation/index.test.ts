import { beforeEach, describe, expect, test } from "bun:test";
import { createTestContext } from "@test/helpers/context";
import { createTestDB } from "@test/helpers/db";
import type { Database } from "@/infra/db/database";
import { createApp } from "./index";

/**
 * Plan 04 の Definition of Done にある「手動 smoke test」を integration test
 * として回す。Hono の `app.request()` で middleware chain + tRPC router を一式
 * 走らせ、実 HTTP に出さずに応答を検証する。
 */

let db: Database;

beforeEach(async () => {
  db = await createTestDB();
});

function buildApp() {
  return createApp(createTestContext(db));
}

describe("presentation/createApp smoke", () => {
  test("GET /health returns ok without auth middleware", async () => {
    const res = await buildApp().request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("POST /api/trpc/auth.startNonce returns a base64url nonce", async () => {
    const res = await buildApp().request("/api/trpc/auth.startNonce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { data: { nonce: string } };
    };
    expect(body.result.data.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("GET /api/trpc/auth.me returns UNAUTHORIZED without Bearer header", async () => {
    // tRPC v11 HTTP: query は GET /path?input=<json>
    const res = await buildApp().request(
      `/api/trpc/auth.me?input=${encodeURIComponent("{}")}`,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { data: { code: string } };
    };
    expect(body.error.data.code).toBe("UNAUTHORIZED");
  });

  test("/api/* response carries Cache-Control: no-store + Vary: Authorization", async () => {
    const res = await buildApp().request(
      `/api/trpc/auth.me?input=${encodeURIComponent("{}")}`,
    );
    expect(res.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate, private, max-age=0",
    );
    expect(res.headers.get("Vary")).toBe("Authorization");
  });

  test("non-/api/* path does not carry no-store (serves static / SPA)", async () => {
    // /health は /api/* ではないので no-store は付かない
    const res = await buildApp().request("/health");
    expect(res.headers.get("Cache-Control")).not.toBe(
      "no-store, no-cache, must-revalidate, private, max-age=0",
    );
  });
});
