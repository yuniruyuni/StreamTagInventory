import type { Session } from "@/models/session";
import type { User } from "@/models/user";
import { type Usecase, usecase } from "@/usecases/runner";

/**
 * 認証済ユーザーの現在の identity を返す。
 *
 * 入力・出力とも `{ user: User; session: Session }` の Model 合成。PR 4 で
 * auth middleware が cookie から session/user を解決し、この usecase 経由で
 * frontend に渡す構図になる。presentation 層で csrf_token 等のフィールドだけ
 * projection する。
 *
 * runner は pre 不在時 `state = input` として scaffold するので、write / result
 * すら不要。input がそのまま result に流れる。
 * 呼出は `me.run(ctx, { user, session })`。
 */
export const me: Usecase<
  { user: User; session: Session },
  { user: User; session: Session }
> = usecase({});
