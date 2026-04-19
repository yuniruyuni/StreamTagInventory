import { createMiddleware } from "hono/factory";

/**
 * `/api/*` の全応答に `Cache-Control: no-store` を強制する。
 *
 * Cloudflare / 中間 CDN が session 紐付きのレスポンスをキャッシュして他ユーザー
 * に配送するリスクを防ぐ。`Vary: Authorization` も併設して「同じ URL でも
 * Authorization が違えば別」ことを明示する (ADR 0006, Bearer ベース)。
 */
export const noStoreMiddleware = createMiddleware(async (c, next) => {
  await next();
  c.res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private, max-age=0",
  );
  c.res.headers.set("Pragma", "no-cache");
  c.res.headers.set("Vary", "Authorization");
});
