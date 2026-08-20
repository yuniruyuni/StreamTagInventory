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
    // hono 4.13 から compress() が Vary に Accept-Encoding を追記する。
    // 圧縮の有無が Accept-Encoding に依存する以上そちらが正しいので、
    // 「Authorization が載っていること」だけを見る。ここが落ちると
    // キャッシュが利用者をまたいで応答を配りうるので緩めないこと。
    const vary = (res.headers.get("Vary") ?? "")
      .split(",")
      .map((v) => v.trim());
    expect(vary).toContain("Authorization");
  });

  test("non-/api/* path does not carry no-store (serves static / SPA)", async () => {
    // /health は /api/* ではないので no-store は付かない
    const res = await buildApp().request("/health");
    expect(res.headers.get("Cache-Control")).not.toBe(
      "no-store, no-cache, must-revalidate, private, max-age=0",
    );
  });
});
