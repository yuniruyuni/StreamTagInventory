import { Session } from "@/models/session";
import { type Usecase, usecase } from "@/usecases/runner";

/**
 * session を削除する。Twitch 側の access_token は revoke しない
 * (Implicit Hybrid は短寿命 token で、別端末での同ユーザー利用を壊さないため)。
 *
 * 入力は `{ sessionId: string }`。middleware が cookie → session 解決済で
 * `ctx.session.id` を持っている前提。Session Model 全体を要求しないのは、
 * presentation 層の `SessionContext` が Session 全列を持たないため (ADR 0005
 * 関連: token_hash 等を presentation に持ち出す意味がない)。
 *
 * 結果は `void` — 成否は runner の `Result<void, Fail>` で判定。
 * 呼出は `logout.run(ctx, { sessionId })`。
 */
export const logout: Usecase<{ sessionId: string }, void> = usecase({
  write: async (ctx, { sessionId }): Promise<void> => {
    await ctx.repos.session.delete(Session.ById(sessionId));
  },
});
