import type { JWTVerifyGetKey } from "jose";
import type { Database } from "../infra/db/database";
import type { ILogger } from "../infra/logger/types";
import type { Repos } from "../repositories";
import type {
  DbRead,
  DbWrite,
  FullRepos,
  Service,
} from "../repositories/common/capability";

/**
 * Twitch OIDC 設定。clientId / jwks は usecase 入力ではなく実行環境設定として
 * Context に乗せる (本番は index.ts、test は createTestContext で差し替える)。
 */
export interface TwitchConfig {
  /** TWITCH_CLIENT_ID — id_token の aud claim 検証に使う */
  clientId: string;
  /** Twitch の公開鍵セット。本番は `twitchJwks` singleton、test は `createLocalJWKSet` */
  jwks: JWTVerifyGetKey;
}

export interface Context {
  now: Date;
  logger: ILogger;
  db: Database;
  rawRepos: Repos;
  repos: FullRepos<Repos>;
  twitch: TwitchConfig;
}

type DbReadRepos<T> = { [K in keyof T]: DbRead<T[K]> };
type DbWriteRepos<T> = { [K in keyof T]: DbWrite<T[K]> };
type ServiceRepos<T> = { [K in keyof T]: Service<T[K]> };

export interface PreContext {
  now: Date;
  logger: ILogger;
  twitch: TwitchConfig;
}

export interface ReadContext {
  now: Date;
  logger: ILogger;
  repos: DbReadRepos<Repos>;
  twitch: TwitchConfig;
}

export interface ProcessContext {
  now: Date;
  logger: ILogger;
  twitch: TwitchConfig;
}

export interface WriteContext {
  now: Date;
  logger: ILogger;
  repos: DbWriteRepos<Repos>;
  twitch: TwitchConfig;
}

export interface PostContext {
  now: Date;
  logger: ILogger;
  repos: ServiceRepos<Repos>;
  twitch: TwitchConfig;
}

export interface FinishContext {
  now: Date;
  logger: ILogger;
  repos: DbWriteRepos<Repos>;
  twitch: TwitchConfig;
}
