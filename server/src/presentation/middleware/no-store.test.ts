import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { noStoreMiddleware } from "./no-store";

function buildApp() {
  const app = new Hono();
  app.use("/api/*", noStoreMiddleware);
  app.get("/api/hello", (c) => c.json({ ok: true }));
  app.get("/public", (c) => c.text("nope"));
  return app;
}

describe("noStoreMiddleware", () => {
  test("sets Cache-Control / Pragma / Vary on /api/* responses", async () => {
    const res = await buildApp().request("/api/hello");
    expect(res.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate, private, max-age=0",
    );
    expect(res.headers.get("Pragma")).toBe("no-cache");
    expect(res.headers.get("Vary")).toBe("Authorization");
  });

  test("does not touch responses outside /api/*", async () => {
    const res = await buildApp().request("/public");
    expect(res.headers.get("Cache-Control")).toBeNull();
    expect(res.headers.get("Pragma")).toBeNull();
  });
});
