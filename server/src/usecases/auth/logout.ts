import { Session } from "@/models/session";
import { type Usecase, usecase } from "@/usecases/runner";

/**
 * session を削除する。Twitch 側の access_token は revoke しない
 * (Implicit Hybrid は短寿命 token で、別端末での同ユーザー利用を壊さないため)。
 *
 * 入力は `Session` Model そのものを受け取る (middleware が cookie → session を
 * 解決済の前提)。結果は `void` — 成否は runner の `Result<void, Fail>` で判定。
 * 呼出は `logout.run(ctx, session)`。
 *
 * `: Usecase<Session, void>` で TInput/TResult を明示することで pre 不要に。
 * write の state は `session: Session` として自動推論される。
 */
export const logout: Usecase<Session, void> = usecase({
  write: async (ctx, session): Promise<void> => {
    await ctx.repos.session.delete(Session.ById(session.id));
  },
});
