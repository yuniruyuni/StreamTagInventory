import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { and, Token } from "@/models/common";
import { Session } from "@/models/session";
import { User } from "@/models/user";
import type { Context as AppContext } from "@/usecases/context";

export const SESSION_COOKIE_NAME = "__Host-sid";

/**
 * Cookie から raw session token を読み、`sha256(raw)` を `Session.ByTokenHash`
 * で DB 照合して session / user を ctx に set する middleware (ADR 0005)。
 *
 * 失敗モード (cookie 無し / 無効 hash / expired / user 削除済) はいずれも
 * 静かに next() で次へ流す = **未ログインとして扱う**。401 にするのは
 * protectedProcedure の役目であってここではない。
 *
 * last_seen_at touch は fire-and-forget。失敗しても先に進む (認証成否に
 * 影響しないため、DB writes の遅延で response を遅らせない意図)。
 */
export function createSessionMiddleware(deps: { ctx: AppContext }) {
  return createMiddleware(async (c, next) => {
    const rawCookie = getCookie(c, SESSION_COOKIE_NAME);
    if (!rawCookie) return next();

    let tokenHash: string;
    try {
      tokenHash = Token.fromBase64url(rawCookie).hash();
    } catch {
      return next();
    }

    const now = new Date();
    // ctx.repos は createFullCtx で bind 済なので single-arg で呼ぶ。
    const session = await deps.ctx.repos.session.get(
      and(Session.ByTokenHash(tokenHash), Session.ActiveAt(now)),
    );
    if (!session) return next();

    const user = await deps.ctx.repos.user.get(User.ById(session.userId));
    if (!user) {
      // user 削除済 (CASCADE で行が残らない筈だが、race を想定して念のため)
      await deps.ctx.repos.session.delete(Session.ById(session.id));
      return next();
    }

    // last_seen_at touch: best effort (fire-and-forget)
    deps.ctx.repos.session
      .upsert({ ...session, lastSeenAt: now })
      .catch((err: unknown) => {
        deps.ctx.logger.warn(`session touch failed: ${String(err)}`);
      });

    c.set("session", {
      id: session.id,
      userId: session.userId,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    });
    c.set("user", {
      id: user.id,
      twitchUserId: user.twitchUserId,
      login: user.login,
      displayName: user.displayName,
    });

    return next();
  });
}
