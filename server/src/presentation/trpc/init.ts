import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "@/usecases/context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * 認証済 procedure。`ctx.user` を non-nullable に narrow して下流に渡す。
 * 未認証は `TRPCError(UNAUTHORIZED)` で 401。
 *
 * jwt-auth middleware (ADR 0007) が `Authorization: Bearer <id_token>` を
 * 検証して user を ctx に乗せていれば認証済。検証失敗 / header 無し =
 * `ctx.user` は undefined のままなので、ここで弾く。
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
