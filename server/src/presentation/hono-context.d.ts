import type { SessionContext, UserContext } from "@/usecases/context";

// Hono の c.set / c.get が返す型を拡張。session middleware が cookie を
// 解決した後、protected endpoint や CSRF middleware から type-safe に
// 参照できるようにする。
declare module "hono" {
  interface ContextVariableMap {
    session?: SessionContext;
    user?: UserContext;
  }
}
