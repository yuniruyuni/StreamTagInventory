import type { Database } from "./infra/db/database";
import type { ILogger } from "./infra/logger/types";
import { CallbackClientImpl } from "./presentation/callback/impl";
import { createRawRepos } from "./repositories";
import { bindAllRepos, createFullCtx } from "./repositories/common/capability";
import type { Context } from "./usecases/context";

export function createContext(db: Database, logger: ILogger): Context {
  // 1. CallbackClient を repos 構築前に作成
  const callbackClient = new CallbackClientImpl();

  // 2. rawRepos 構築（将来 callbackClient を必要なリポジトリに注入する）
  const rawRepos = createRawRepos();
  const repos = bindAllRepos(rawRepos, createFullCtx(db));

  const ctx: Context = {
    now: new Date(),
    logger,
    db,
    rawRepos,
    repos,
  };

  // 3. Context 構築後に遅延初期化
  callbackClient.initialize(ctx);

  return ctx;
}
