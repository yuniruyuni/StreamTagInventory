import type { JWTVerifyGetKey } from "jose";
import type { Database } from "../infra/db/database";
import type { ILogger } from "../infra/logger/types";
import type { Token } from "../models/common";
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

/**
 * presentation 層の Hono middleware が resolve した session / user の射影。
 * Model 全列ではなく、usecase / router が必要とする最小フィールドに絞る。
 * tokenHash など DB 内部状態は意図的に持ち込まない (ADR 0005 の境界)。
 */
export interface SessionContext {
  id: string;
  userId: string;
  csrfToken: Token;
  expiresAt: Date;
}

export interface UserContext {
  id: string;
  twitchUserId: string;
  login: string;
  displayName: string;
}

/**
 * Hono の cookie API を tRPC router から触れるようにする抽象。
 * tRPC は HTTP を持たないため、createContext callback で Hono `c` から閉じた
 * set / delete 関数を埋めて渡す。
 */
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  path?: string;
  maxAge?: number;
}

export interface CookieJar {
  set: (name: string, value: string, options: CookieOptions) => void;
  delete: (name: string, options: { path?: string }) => void;
}

export interface Context {
  now: Date;
  logger: ILogger;
  db: Database;
  rawRepos: Repos;
  repos: FullRepos<Repos>;
  twitch: TwitchConfig;
  /** middleware が resolve した session。未ログイン時は undefined。 */
  session?: SessionContext;
  /** middleware が resolve した user。未ログイン時は undefined。 */
  user?: UserContext;
  /** tRPC context builder が cookie API を注入する。test / 非 HTTP は undefined。 */
  cookieJar?: CookieJar;
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
