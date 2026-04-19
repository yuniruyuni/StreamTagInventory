import { createMiddleware } from "hono/factory";
import { Token } from "@/models/common";

/**
 * mutation (= 副作用あり HTTP method) に対して `X-CSRF-Token` header を検証する。
 *
 * GET / HEAD / OPTIONS は副作用なしなので skip。未ログインの mutation は
 * `session` が ctx に無いので skip (その場合 protectedProcedure 側で 401 にして
 * もらう)。CSRF 比較は `Token.equals()` が内部で長さ check + `timingSafeEqual`
 * を実施する。
 *
 * Token.fromBase64url は lenient decode のため、非 base64 文字は silently 落ちる
 * が、decode 後の byte 長が 0 や 16 等の short 入力でも `equals` 側で長さ check
 * により弾かれる (攻撃者の推測時間を増やさない)。
 */
export const csrfMiddleware = createMiddleware(async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const session = c.get("session");
  if (!session) {
    // 未ログイン mutation は別レイヤで 401 にする (例: protectedProcedure)。
    // ここで 403 を返すと「未ログイン + mutation」の挙動が混乱するため skip。
    return next();
  }

  const header = c.req.header("x-csrf-token");
  if (!header) {
    return c.json({ error: "csrf_token missing" }, 403);
  }

  let incoming: Token;
  try {
    incoming = Token.fromBase64url(header);
  } catch {
    return c.json({ error: "csrf_token malformed" }, 403);
  }
  if (!session.csrfToken.equals(incoming)) {
    return c.json({ error: "csrf_token mismatch" }, 403);
  }

  return next();
});
