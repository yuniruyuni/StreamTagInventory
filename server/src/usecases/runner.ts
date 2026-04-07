import type { Fail } from "../models/common/fail";
import { fail, isFail } from "../models/common/fail";
import type { Result } from "../models/common/result";
import {
  bindAllRepos,
  createDbReadCtx,
  createDbWriteCtx,
  createServiceCtx,
} from "../repositories/common/capability";
import type {
  Context,
  FinishContext,
  PostContext,
  PreContext,
  ProcessContext,
  ReadContext,
  WriteContext,
} from "./context";

type MaybePromise<T> = T | Promise<T>;
type Unfail<T> = Exclude<T, Fail>;

export interface Usecase<T> {
  run(ctx: Context): Promise<Result<T, Fail>>;
}

interface UsecaseDefinition<
  TPre,
  TRead,
  TProcess,
  TWrite,
  TPost,
  TFinish,
  TResult,
> {
  pre?: (ctx: PreContext) => MaybePromise<TPre | Fail>;
  read?: (ctx: ReadContext, state: Unfail<TPre>) => MaybePromise<TRead | Fail>;
  process?: (
    ctx: ProcessContext,
    state: Unfail<TRead>,
  ) => MaybePromise<TProcess | Fail>;
  write?: (
    ctx: WriteContext,
    state: Unfail<TProcess>,
  ) => MaybePromise<TWrite | Fail>;
  post?: (
    ctx: PostContext,
    state: Unfail<TWrite>,
  ) => MaybePromise<TPost | Fail>;
  finish?: (
    ctx: FinishContext,
    state: Unfail<TPost>,
  ) => MaybePromise<TFinish | Fail>;
  result?: (state: Unfail<TFinish>) => MaybePromise<TResult>;
}

export function usecase<TPre, TRead, TProcess, TWrite, TPost, TFinish, TResult>(
  def: UsecaseDefinition<
    TPre,
    TRead,
    TProcess,
    TWrite,
    TPost,
    TFinish,
    TResult
  >,
): Usecase<TResult> {
  return {
    async run(ctx: Context): Promise<Result<TResult, Fail>> {
      try {
        // Phase 1: pre (outside transaction)
        let state: unknown = await (def.pre?.({
          now: ctx.now,
          logger: ctx.logger,
        }) ?? {});
        if (isFail(state)) return { ok: false, error: state };

        // Phase 2-4: read → process → write
        const writeFn = def.write;
        if (writeFn) {
          state = await ctx.db.transaction(async (tx) => {
            let s = state;

            if (def.read) {
              const readCtx: ReadContext = {
                now: ctx.now,
                logger: ctx.logger,
                repos: bindAllRepos(ctx.rawRepos, createDbReadCtx(tx)),
              };
              s = await def.read(readCtx, s as Unfail<TPre>);
              if (isFail(s)) return s;
            }

            if (def.process) {
              s = await def.process(
                { now: ctx.now, logger: ctx.logger },
                s as Unfail<TRead>,
              );
              if (isFail(s)) return s;
            }

            const writeCtx: WriteContext = {
              now: ctx.now,
              logger: ctx.logger,
              repos: bindAllRepos(ctx.rawRepos, createDbWriteCtx(tx)),
            };
            s = await writeFn(writeCtx, s as Unfail<TProcess>);
            return s;
          });
          if (isFail(state)) return { ok: false, error: state };
        } else if (def.read) {
          const readFn = def.read;
          state = await ctx.db.readTransaction(async (tx) => {
            const readCtx: ReadContext = {
              now: ctx.now,
              logger: ctx.logger,
              repos: bindAllRepos(ctx.rawRepos, createDbReadCtx(tx)),
            };
            return readFn(readCtx, state as Unfail<TPre>);
          });
          if (isFail(state)) return { ok: false, error: state };

          if (def.process) {
            state = await def.process(
              { now: ctx.now, logger: ctx.logger },
              state as Unfail<TRead>,
            );
            if (isFail(state)) return { ok: false, error: state };
          }
        } else if (def.process) {
          state = await def.process(
            { now: ctx.now, logger: ctx.logger },
            state as Unfail<TRead>,
          );
          if (isFail(state)) return { ok: false, error: state };
        }

        // Phase 5: post (outside transaction, service context)
        if (def.post) {
          const postCtx: PostContext = {
            now: ctx.now,
            logger: ctx.logger,
            repos: bindAllRepos(ctx.rawRepos, createServiceCtx()),
          };
          state = await def.post(postCtx, state as Unfail<TWrite>);
          if (isFail(state)) return { ok: false, error: state };
        }

        // Phase 6: finish (new transaction)
        const finishFn = def.finish;
        if (finishFn) {
          state = await ctx.db.transaction(async (tx) => {
            const finishCtx: FinishContext = {
              now: ctx.now,
              logger: ctx.logger,
              repos: bindAllRepos(ctx.rawRepos, createDbWriteCtx(tx)),
            };
            return finishFn(finishCtx, state as Unfail<TPost>);
          });
          if (isFail(state)) return { ok: false, error: state };
        }

        // Phase 7: result
        const result = await (def.result?.(state as Unfail<TFinish>) ?? state);
        return { ok: true, value: result as TResult };
      } catch (error) {
        ctx.logger.error("Unexpected error in usecase:", error);
        return {
          ok: false,
          error: fail("INTERNAL", "An unexpected error occurred"),
        };
      }
    },
  };
}
