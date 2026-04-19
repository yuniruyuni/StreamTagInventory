import { createMiddleware } from "hono/factory";
import { verifyIdToken } from "@/infra/twitch/verify-id-token";
import type { Context as AppContext } from "@/usecases/context";

/**
 * `Authorization: Bearer <id_token>` を毎リクエスト検証して `c.set("user", ...)` に
 * Twitch identity を resolve する middleware (ADR 0007)。
 *
 * 失敗モード (header 無し / 形式不正 / JWT 検証失敗 / sub 無し) はいずれも静かに
 * `next()` で次へ流す = **未ログインとして扱う**。401 を返すのは
 * `protectedProcedure` の役目で、本 middleware は資格情報の resolve のみ。
 *
 * ADR 0007 で users 表を撤去したため、DB I/O は発生しない。identity は JWT claim
 * (sub = Twitch user id, preferred_username) から直接 UserContext を組み立てる。
 * template_docs.user_id も Twitch user id を PK として持つので、ctx.user.id を
 * そのまま FK として扱える。
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
    const login = claims.preferred_username ?? "";

    c.set("user", {
      id: claims.sub,
      twitchUserId: claims.sub,
      login,
      displayName: login,
    });

    return next();
  });
}
