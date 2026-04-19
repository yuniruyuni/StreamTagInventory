import type { UserContext } from "@/usecases/context";

/**
 * 認証済ユーザーの identity を返す presentation 用射影 (ADR 0006)。
 *
 * DB I/O を伴わないため usecase runner には乗せない。middleware が既に
 * resolve した `UserContext` をそのまま受け取り、HTTP 応答形へ projection
 * するだけの pure 関数。呼出側 (auth.me endpoint) は `protectedProcedure`
 * により `ctx.user` が non-nullable に narrow された状態で渡す。
 *
 * CSRF token は ADR 0006 (Bearer 方式) で廃止されたため返さない。
 */
export interface MeResult {
  user: UserContext;
}

export function meHandler(user: UserContext): MeResult {
  return { user };
}
