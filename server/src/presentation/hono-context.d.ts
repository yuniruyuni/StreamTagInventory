import type { UserContext } from "@/usecases/context";

// Hono の c.set / c.get が返す型を拡張。jwt-auth middleware (ADR 0007) が
// id_token を verify した後、protected endpoint から type-safe に参照できる
// ようにする。
declare module "hono" {
  interface ContextVariableMap {
    user?: UserContext;
  }
}
