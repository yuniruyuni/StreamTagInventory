import { router } from "../init";
import { authRouter } from "./auth";
import { templatesRouter } from "./templates";

export const appRouter = router({
  auth: authRouter,
  templates: templatesRouter,
});

export type AppRouter = typeof appRouter;
