import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "@/usecases/context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * 認証済 procedure。`ctx.user` / `ctx.session` を non-nullable に narrow して
 * 下流に渡す。未認証は `TRPCError(UNAUTHORIZED)` で 401。
 *
 * middleware (session.ts) が cookie → Session を resolve していれば user /
 * session が ctx に乗ってくる。未ログイン = 両方 undefined のパターンのみ
 * ここで弾く。
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  });
});
