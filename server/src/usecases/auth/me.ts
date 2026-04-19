import type { SessionContext, UserContext } from "@/usecases/context";

/**
 * 認証済ユーザーの identity と CSRF token を返す presentation 用射影。
 *
 * DB I/O を伴わないため usecase runner には乗せない。middleware が既に
 * resolve した `SessionContext` / `UserContext` をそのまま受け取り、HTTP
 * 応答に必要な形へ projection するだけの pure 関数。
 *
 * 呼出側 (auth.me endpoint) は `protectedProcedure` により `ctx.user` /
 * `ctx.session` が non-nullable に narrow された状態で渡す。
 */
export interface MeResult {
  user: UserContext;
  csrfToken: string;
}

export function meHandler(
  user: UserContext,
  session: SessionContext,
): MeResult {
  return {
    user,
    csrfToken: session.csrfToken.toBase64url(),
  };
}
