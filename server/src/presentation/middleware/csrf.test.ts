import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { Token } from "@/models/common";
import type { SessionContext } from "@/usecases/context";
import { csrfMiddleware } from "./csrf";

function buildApp(session?: SessionContext) {
  const app = new Hono();
  // session をセットする bypass middleware (session middleware の代役)
  app.use("*", async (c, next) => {
    if (session) c.set("session", session);
    return next();
  });
  app.use("*", csrfMiddleware);
  app.get("/", (c) => c.json({ method: "GET" }));
  app.post("/", (c) => c.json({ method: "POST" }));
  return app;
}

function makeSession(csrfToken: Token): SessionContext {
  return {
    id: "session-id",
    userId: "user-id",
    csrfToken,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

describe("csrfMiddleware", () => {
  test("skips GET requests entirely (no header required)", async () => {
    const res = await buildApp(makeSession(Token.generate())).request("/", {
      method: "GET",
    });
    expect(res.status).toBe(200);
  });

  test("skips mutation when session is absent (let protectedProcedure handle 401)", async () => {
    const res = await buildApp(undefined).request("/", {
      method: "POST",
    });
    expect(res.status).toBe(200);
  });

  test("403 when X-CSRF-Token header is missing on mutation", async () => {
    const res = await buildApp(makeSession(Token.generate())).request("/", {
      method: "POST",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("csrf_token missing");
  });

  test("403 when X-CSRF-Token does not match session token", async () => {
    const res = await buildApp(makeSession(Token.generate())).request("/", {
      method: "POST",
      headers: { "x-csrf-token": Token.generate().toBase64url() },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("csrf_token mismatch");
  });

  test("passes when X-CSRF-Token matches session token", async () => {
    const csrf = Token.generate();
    const res = await buildApp(makeSession(csrf)).request("/", {
      method: "POST",
      headers: { "x-csrf-token": csrf.toBase64url() },
    });
    expect(res.status).toBe(200);
  });
});
