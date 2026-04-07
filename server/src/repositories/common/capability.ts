import type { Database } from "../../infra/db/database";

const _dbRead: unique symbol = Symbol("dbRead");
const _dbWrite: unique symbol = Symbol("dbWrite");
const _service: unique symbol = Symbol("service");

export interface DbReadCtx {
  readonly [_dbRead]: true;
  readonly db: Database;
}

export interface DbWriteCtx extends DbReadCtx {
  readonly [_dbWrite]: true;
}

export interface ServiceCtx {
  readonly [_service]: true;
}

export type ExtractMethods<T, Marker> = {
  [K in keyof T as T[K] extends (m: Marker, ...args: infer _A) => infer _R
    ? K
    : never]: T[K] extends (m: Marker, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;
};

export type DbRead<T> = ExtractMethods<T, DbReadCtx>;
export type DbWrite<T> = ExtractMethods<T, DbWriteCtx>;
export type Service<T> = ExtractMethods<T, ServiceCtx>;
export type Full<T> = ExtractMethods<T, DbWriteCtx & ServiceCtx>;

export type FullRepos<T> = { [K in keyof T]: Full<T[K]> };

export function bindCtx<T extends object, Ctx>(
  repo: T,
  ctx: Ctx,
): ExtractMethods<T, Ctx> {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) => value.call(target, ctx, ...args);
      }
      return value;
    },
  }) as ExtractMethods<T, Ctx>;
}

// --- Factory functions ---
// symbol はこのモジュール内でのみ存在するため、
// ブランド付きコンテキストの構築もここで提供する。

export function createDbReadCtx(db: Database): DbReadCtx {
  return { [_dbRead]: true, db };
}

export function createDbWriteCtx(db: Database): DbWriteCtx {
  return { [_dbRead]: true, [_dbWrite]: true, db };
}

export function createServiceCtx(): ServiceCtx {
  return { [_service]: true };
}

export function createFullCtx(db: Database): DbWriteCtx & ServiceCtx {
  return { [_dbRead]: true, [_dbWrite]: true, [_service]: true, db };
}

// --- Batch binding ---
// rawRepos の全リポジトリを指定コンテキストでバインドする。

export function bindAllRepos<R extends { [K in keyof R]: object }, Ctx>(
  rawRepos: R,
  ctx: Ctx,
): { [K in keyof R]: ExtractMethods<R[K], Ctx> } {
  const bound = {} as { [K in keyof R]: ExtractMethods<R[K], Ctx> };
  for (const [key, repo] of Object.entries(rawRepos)) {
    (bound as Record<string, unknown>)[key] = bindCtx(repo as object, ctx);
  }
  return bound;
}
