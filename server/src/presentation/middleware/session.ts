import { createMiddleware } from "hono/factory";
import { and, Token } from "@/models/common";
import { Session } from "@/models/session";
import { User } from "@/models/user";
import type { Context as AppContext } from "@/usecases/context";

/**
 * `Authorization: Bearer <raw>` ヘッダから raw session token を読み、
 * `sha256(raw)` を `Session.ByTokenHash` で DB 照合して session / user を
 * ctx に set する middleware (ADR 0006)。
 *
 * 失敗モード (header 無し / 形式不正 / 無効 hash / expired / user 削除済) は
 * いずれも静かに next() で次へ流す = **未ログインとして扱う**。401 を返すのは
 * `protectedProcedure` の役目であってここではない。
 *
 * `last_seen_at` touch は fire-and-forget。失敗しても先に進む。
 */
export function createSessionMiddleware(deps: { ctx: AppContext }) {
  return createMiddleware(async (c, next) => {
    const authHeader = c.req.header("authorization");
    const match = authHeader?.match(/^Bearer\s+(\S+)$/i);
    if (!match) return next();
    const rawToken = match[1];

    let tokenHash: string;
    try {
      tokenHash = Token.fromBase64url(rawToken).hash();
    } catch {
      return next();
    }

    const now = new Date();
    const session = await deps.ctx.repos.session.get(
      and(Session.ByTokenHash(tokenHash), Session.ActiveAt(now)),
    );
    if (!session) return next();

    const user = await deps.ctx.repos.user.get(User.ById(session.userId));
    if (!user) {
      // user 削除済 (CASCADE で行が残らない筈だが、race に備えて念のため掃除)
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
