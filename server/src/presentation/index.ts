import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import type { Context } from "../usecases/context";
import { appRouter } from "./trpc/routers";

const STATIC_DIR = process.env.STATIC_DIR ?? "./static";

export function createApp(ctx: Context) {
  const app = new Hono();

  app.use(compress());

  app.use(
    secureHeaders({
      xFrameOptions: "SAMEORIGIN",
      xContentTypeOptions: "nosniff",
      xXssProtection: "1; mode=block",
      referrerPolicy: "strict-origin-when-cross-origin",
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.twitch.tv"],
        frameAncestors: ["'none'"],
      },
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.use(
    "/api/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: () => ctx as unknown as Record<string, unknown>,
    }),
  );

  app.use("/*", async (c, next) => {
    await next();
    if (c.res.status < 400) {
      c.res.headers.set(
        "Cache-Control",
        "public, max-age=0, stale-while-revalidate=86400",
      );
    }
  });

  app.use("/*", serveStatic({ root: STATIC_DIR }));
  app.get("*", serveStatic({ root: STATIC_DIR, path: "index.html" }));

  return app;
}
