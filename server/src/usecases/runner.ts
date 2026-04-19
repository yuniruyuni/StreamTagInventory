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

/**
 * `run` の引数。`TInput = undefined` の usecase は `run(ctx)` で呼べる。
 * 入力を持つ usecase は `run(ctx, input)` が必須。
 */
type RunArgs<TInput> = undefined extends TInput
  ? [ctx: Context]
  : [ctx: Context, input: TInput];

export interface Usecase<TInput, TResult> {
  run(...args: RunArgs<TInput>): Promise<Result<TResult, Fail>>;
}

interface UsecaseDefinition<
  TInput,
  TPre,
  TRead,
  TProcess,
  TWrite,
  TPost,
  TFinish,
  TResult,
> {
  /**
   * 入力のバリデーションと初期 state 組み立て。input は `run(ctx, input)` で
   * 受け取った値が渡される (入力なしの usecase では undefined)。返り値が
   * `Fail` なら実行は即中断し `Result<_, Fail>` が返る。
   */
  pre?: (ctx: PreContext, input: TInput) => MaybePromise<TPre | Fail>;
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

export function usecase<
  TInput = undefined,
  TPre = TInput extends undefined ? Record<string, never> : TInput,
  TRead = TPre,
  TProcess = TRead,
  TWrite = TProcess,
  TPost = TWrite,
  TFinish = TPost,
  TResult = TFinish,
>(
  def: UsecaseDefinition<
    TInput,
    TPre,
    TRead,
    TProcess,
    TWrite,
    TPost,
    TFinish,
    TResult
  >,
): Usecase<TInput, TResult> {
  return {
    async run(...args: RunArgs<TInput>): Promise<Result<TResult, Fail>> {
      const [ctx, maybeInput] = args as [Context, TInput | undefined];
      const input = maybeInput as TInput;
      try {
        // Phase 1: pre (outside transaction)
        let state: unknown = def.pre
          ? await def.pre(
              {
                now: ctx.now,
                logger: ctx.logger,
                twitch: ctx.twitch,
              },
              input,
            )
          : (input ?? {});
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
                twitch: ctx.twitch,
              };
              s = await def.read(readCtx, s as Unfail<TPre>);
              if (isFail(s)) return s;
            }

            if (def.process) {
              s = await def.process(
                { now: ctx.now, logger: ctx.logger, twitch: ctx.twitch },
                s as Unfail<TRead>,
              );
              if (isFail(s)) return s;
            }

            const writeCtx: WriteContext = {
              now: ctx.now,
              logger: ctx.logger,
              repos: bindAllRepos(ctx.rawRepos, createDbWriteCtx(tx)),
              twitch: ctx.twitch,
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
              twitch: ctx.twitch,
            };
            return readFn(readCtx, state as Unfail<TPre>);
          });
          if (isFail(state)) return { ok: false, error: state };

          if (def.process) {
            state = await def.process(
              { now: ctx.now, logger: ctx.logger, twitch: ctx.twitch },
              state as Unfail<TRead>,
            );
            if (isFail(state)) return { ok: false, error: state };
          }
        } else if (def.process) {
          state = await def.process(
            { now: ctx.now, logger: ctx.logger, twitch: ctx.twitch },
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
            twitch: ctx.twitch,
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
              twitch: ctx.twitch,
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
