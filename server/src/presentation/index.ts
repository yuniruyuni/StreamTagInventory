import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import type { Context } from "../usecases/context";
import { createJwtAuthMiddleware } from "./middleware/jwt-auth";
import { noStoreMiddleware } from "./middleware/no-store";
import { requestLog } from "./middleware/request-log";
import { appRouter } from "./trpc/routers";

// hono-context.d.ts に ContextVariableMap 拡張あり。明示的に import はせず
// ambient として TS に拾わせる。

const STATIC_DIR = process.env.STATIC_DIR ?? "./static";

export function createApp(ctx: Context) {
  const app = new Hono();

  // いちばん外側に置く。内側で何が起きても 1 行は残る。
  app.use(requestLog(ctx.logger));
  app.use(compress());

  app.use(
    secureHeaders({
      xFrameOptions: "SAMEORIGIN",
      xContentTypeOptions: "nosniff",
      xXssProtection: "1; mode=block",
      referrerPolicy: "strict-origin-when-cross-origin",
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        // Cloudflare proxy 経由 (本番) では Cloudflare Insights の beacon.min.js が
        // 自動注入されるため static.cloudflareinsights.com を許可。許可しないと
        // browser console にエラーが出続けて UX 上ノイズになる (機能影響は無い)。
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://static.cloudflareinsights.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        // Twitch API 直接呼出 + Cloudflare Insights の telemetry 送信先。
        connectSrc: [
          "'self'",
          "https://api.twitch.tv",
          "https://cloudflareinsights.com",
        ],
        frameAncestors: ["'none'"],
      },
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  // /api/* 群に適用する middleware 列。no-store → JWT 検証。
  // ADR 0006 で CSRF middleware を撤去、ADR 0007 で server session の DB lookup を
  // 廃止して id_token を per-request 検証する jwt-auth middleware に差し替えた。
  app.use("/api/*", noStoreMiddleware);
  app.use("/api/*", createJwtAuthMiddleware({ ctx }));

  app.post("/api/usage/visit", async (c) => {
    c.header("Cache-Control", "no-store");
    if (c.req.header("X-Yuniview-Visit") !== "1") return c.body(null, 400);
    const id = c.get("user")?.id;
    if (!id) return c.body(null, 401);
    try {
      const response = await fetch("http://localhost/visit", {
        unix: "/run/yuniview-otlp/usage.sock",
        method: "POST",
        body: id,
        signal: AbortSignal.timeout(1500),
      });
      return c.body(null, response.status === 204 ? 204 : 503);
    } catch {
      return c.body(null, 503);
    }
  });

  app.use(
    "/api/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: (_opts, c) => ({
        ...ctx,
        user: c.get("user"),
      }),
    }),
  );

  app.use("/*", async (c, next) => {
    await next();
    if (c.req.path.startsWith("/api/")) return;
    if (c.res.status < 400) {
      c.res.headers.set(
        "Cache-Control",
        "public, max-age=0, stale-while-revalidate=86400",
      );
    }
  });

  app.get("/privacy", serveStatic({ root: STATIC_DIR, path: "privacy.html" }));
  app.use("/*", serveStatic({ root: STATIC_DIR }));
  app.get("*", serveStatic({ root: STATIC_DIR, path: "index.html" }));

  return app;
}
