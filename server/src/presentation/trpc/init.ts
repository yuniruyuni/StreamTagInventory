import { initTRPC } from "@trpc/server";
import type { Context } from "../../usecases/context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
