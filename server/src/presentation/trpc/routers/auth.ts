import { protectedProcedure, router } from "@/presentation/trpc/init";
import { meHandler } from "@/usecases/auth/me";

/**
 * 認証関連 tRPC ルーター (ADR 0007 = stateless JWT bearer)。
 *
 * client は Twitch id_token を sessionStorage に保管し、
 * `Authorization: Bearer ${idToken}` で毎リクエスト送信する。
 * 本ルーターは「認証済 user identity の取得 (me)」のみを公開する。
 *
 * - `startNonce` / `login` / `logout` は ADR 0007 で全て撤去済。
 *   - nonce 生成 / 照合は client 側担当 (sessionStorage + id_token claim 比較)
 *   - login: id_token の per-request 検証で代替 (jwt-auth middleware が担当)
 *   - logout: client が sessionStorage から id_token を消すだけで成立 (server 側状態無し)
 */
export const authRouter = router({
  /**
   * 認証済ユーザーの identity を返す。未認証は protectedProcedure が
   * UNAUTHORIZED で弾く。
   */
  me: protectedProcedure.query(({ ctx }) => meHandler(ctx.user)),
});
