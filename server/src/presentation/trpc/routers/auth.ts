import { z } from "zod";
import { Session } from "@/models/session";
import { SESSION_COOKIE_NAME } from "@/presentation/middleware/session";
import { handleResult } from "@/presentation/trpc/handle-result";
import {
  protectedProcedure,
  publicProcedure,
  router,
} from "@/presentation/trpc/init";
import { login } from "@/usecases/auth/login";
import { logout } from "@/usecases/auth/logout";
import { meHandler } from "@/usecases/auth/me";
import { startNonce } from "@/usecases/auth/startNonce";

/**
 * 認証関連 tRPC ルーター。cookie は `ctx.cookieJar` 経由でのみ触る
 * (tRPC は HTTP 抽象を持たないため、presentation/index.ts の createContext で
 * Hono `c` を閉じた CookieJar を注入している)。
 */
export const authRouter = router({
  /**
   * 新しい OIDC nonce を発行。client は authorize URL の `nonce` パラメータに
   * 埋め込み、login 時に照合する。
   */
  startNonce: publicProcedure.mutation(async ({ ctx }) => {
    const result = await startNonce.run(ctx);
    const value = handleResult(result);
    return { nonce: value.nonce.toBase64url() };
  }),

  /**
   * id_token を検証して login。成功すれば raw session token を
   * `__Host-sid` cookie にセットし、body で user + csrfToken を返す。
   * raw session token は cookie 経由でしかクライアントに渡さない (ADR 0005)。
   */
  login: publicProcedure
    .input(
      z.object({
        idToken: z.string().min(1),
        nonce: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await login.run(ctx, {
        idToken: input.idToken,
        nonce: input.nonce,
      });
      const value = handleResult(result);

      ctx.cookieJar?.set(SESSION_COOKIE_NAME, value.rawSessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        maxAge: Math.floor(Session.TTL_MS / 1000),
      });

      return {
        user: {
          id: value.user.id,
          twitchUserId: value.user.twitchUserId,
          login: value.user.login,
          displayName: value.user.displayName,
        },
        csrfToken: value.session.csrfToken.toBase64url(),
      };
    }),

  /**
   * 現 session を破棄 + cookie を削除。
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await logout.run(ctx, { sessionId: ctx.session.id });
    handleResult(result);
    ctx.cookieJar?.delete(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true as const };
  }),

  /**
   * 認証済ユーザーの identity + CSRF token を返す。未認証は protectedProcedure
   * が UNAUTHORIZED で弾く。
   */
  me: protectedProcedure.query(({ ctx }) => {
    return meHandler(ctx.user, ctx.session);
  }),
});
