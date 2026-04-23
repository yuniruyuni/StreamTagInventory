import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import type { Context } from "../usecases/context";
import { createJwtAuthMiddleware } from "./middleware/jwt-auth";
import { noStoreMiddleware } from "./middleware/no-store";
import { appRouter } from "./trpc/routers";

// hono-context.d.ts に ContextVariableMap 拡張あり。明示的に import はせず
// ambient として TS に拾わせる。

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
      // Hono の secureHeaders はデフォルトで Cross-Origin-Opener-Policy:
      // same-origin を送る。これが有効だと OAuth implicit flow の cross-origin
      // redirect (tags → id.twitch.tv → tags) で browsing context group が
      // 切り替わり、同じタブでも sessionStorage が wholesale クリアされる挙動
      // になる。nonce の sessionStorage 保管が callback 着地時に失われ、
      // 「nonce mismatch で初回ログイン失敗 → 2 度ログイン必要」という症状に
      // なっていた。
      //
      // 本ツールの脅威モデル (個人配信者 1 ユーザ、機密クロスオリジン資源なし) では
      // COOP による Spectre 緩和の便益が薄いため disable する。必要なら他の
      // header (X-Frame-Options / CSP frame-ancestors) で iframe 禁止、
      // `origin-agent-cluster: ?1` でメモリ隔離を別途担保する。
      crossOriginOpenerPolicy: false,
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

  app.use("/*", serveStatic({ root: STATIC_DIR }));
  app.get("*", serveStatic({ root: STATIC_DIR, path: "index.html" }));

  return app;
}
