import type { JWTVerifyGetKey } from "jose";
import type { Database } from "@/infra/db/database";
import type { ILogger } from "@/infra/logger/types";
import { createRawRepos } from "@/repositories";
import { bindAllRepos, createFullCtx } from "@/repositories/common/capability";
import type { Context, TwitchConfig } from "@/usecases/context";

/**
 * Silent logger — test 時に stdout を汚さない。
 */
export const silentLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

/**
 * test 用のフォールバック TwitchConfig。JWKS は「必ず verification に失敗する」
 * ダミーで、id_token を扱わない usecase (startNonce / logout) からは使われない。
 * id_token を扱う login 系 test は明示的に test 用 JWKS を注入する。
 */
const dummyJwks: JWTVerifyGetKey = async () => {
  throw new Error("test context: jwks not configured");
};

const defaultTwitchConfig: TwitchConfig = {
  clientId: "test-client-id",
  jwks: dummyJwks,
};

/**
 * test 用の usecase Context を組み立てる。`now` は固定したければ引数で渡す
 * (時間依存ロジックの再現テストに使う)。
 */
export function createTestContext(
  db: Database,
  options?: { now?: Date; twitch?: TwitchConfig },
): Context {
  const rawRepos = createRawRepos();
  const repos = bindAllRepos(rawRepos, createFullCtx(db));
  return {
    now: options?.now ?? new Date(),
    logger: silentLogger,
    db,
    rawRepos,
    repos,
    twitch: options?.twitch ?? defaultTwitchConfig,
  };
}
