import { z } from "zod";
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
 * 認証関連 tRPC ルーター (ADR 0006 = Bearer ベース)。
 * raw session token は login 応答 body で client に渡し、client は
 * sessionStorage に保管して `Authorization: Bearer` で以降のリクエストに付与する。
 * Cookie / CSRF token は使わない。
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
   * id_token を検証して login。成功すれば `sid` (raw session token, base64url)
   * を body で返す。client は sessionStorage に保存して以降のリクエストで
   * `Authorization: Bearer ${sid}` で送信する。raw は DB には保存せず
   * `sha256(raw)` のみ (ADR 0006)。
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
      return {
        sid: value.rawSessionToken,
        user: {
          id: value.user.id,
          twitchUserId: value.user.twitchUserId,
          login: value.user.login,
          displayName: value.user.displayName,
        },
      };
    }),

  /**
   * 現 session を破棄。server 側は DB 行を削除するだけ。client は自身で
   * sessionStorage から `sid` を消す責務を持つ (応答後の後始末)。
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await logout.run(ctx, { sessionId: ctx.session.id });
    handleResult(result);
    return { ok: true as const };
  }),

  /**
   * 認証済ユーザーの identity を返す。未認証は protectedProcedure が
   * UNAUTHORIZED で弾く。
   */
  me: protectedProcedure.query(({ ctx }) => meHandler(ctx.user)),
});
