import { createMiddleware } from "hono/factory";
import { verifyIdToken } from "@/infra/twitch/verify-id-token";
import { User } from "@/models/user";
import type { Context as AppContext } from "@/usecases/context";

/**
 * `Authorization: Bearer <id_token>` を毎リクエスト検証して `c.set("user", ...)` に
 * Twitch identity を resolve する middleware (ADR 0007)。
 *
 * 失敗モード (header 無し / 形式不正 / JWT 検証失敗 / sub 無し) はいずれも静かに
 * `next()` で次へ流す = **未ログインとして扱う**。401 を返すのは
 * `protectedProcedure` の役目で、本 middleware は資格情報の resolve のみ。
 *
 * ユーザー行の find-or-create は本 middleware 内で行う:
 *   - users 表を `ByTwitchUserId` で lookup
 *   - 無ければ id_token claim から `User.create` して upsert
 *   - これで JWT を持っているだけでサーバー API が叩ける (ADR 0007 が想定する
 *     stateless 動作)
 *
 * nonce は ADR 0007 で client 側担当に移ったため、server では検証しない。
 */
export function createJwtAuthMiddleware(deps: { ctx: AppContext }) {
  return createMiddleware(async (c, next) => {
    const authHeader = c.req.header("authorization");
    const match = authHeader?.match(/^Bearer\s+(\S+)$/i);
    if (!match) return next();
    const idToken = match[1];

    const verified = await verifyIdToken(idToken, deps.ctx.twitch.jwks, {
      expectedAudience: deps.ctx.twitch.clientId,
    });
    if (!verified.ok) {
      // 期限切れ / 署名不正 / aud 不一致など。ログには cause だけ出して token は
      // 出さない (verify-id-token.ts 側でも token を出さないよう保証している)。
      deps.ctx.logger.debug(`jwt verify failed: ${verified.error.message}`);
      return next();
    }
    const claims = verified.value;

    const now = new Date();
    const existing = await deps.ctx.repos.user.get(
      User.ByTwitchUserId(claims.sub),
    );
    const user: User = existing
      ? {
          ...existing,
          login: claims.preferred_username ?? existing.login,
          displayName: claims.preferred_username ?? existing.displayName,
          updatedAt: now,
          lastLoginAt: now,
        }
      : User.create({
          twitchUserId: claims.sub,
          login: claims.preferred_username ?? "",
          displayName: claims.preferred_username ?? "",
          now,
        });

    // first-call なら INSERT、以降は UPDATE。lastLoginAt の touch は best effort。
    // upsert 失敗時はリクエストを通したいので fire-and-forget せず await 中の
    // throw を握り潰し、context には existing or fresh User をそのまま乗せる。
    try {
      await deps.ctx.repos.user.upsert(user);
    } catch (err) {
      deps.ctx.logger.warn(`user upsert failed (continuing): ${String(err)}`);
    }

    c.set("user", {
      id: user.id,
      twitchUserId: user.twitchUserId,
      login: user.login,
      displayName: user.displayName,
    });

    return next();
  });
}
