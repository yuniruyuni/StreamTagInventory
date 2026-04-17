import type { Comp, Cursor, Page } from "@/models/common";
import type { User } from "@/models/user";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface UserRepository {
  get(ctx: DbReadCtx, spec: Comp<User.Spec>): Promise<User | null>;
  list(
    ctx: DbReadCtx,
    spec: Comp<User.Spec>,
    cursor: Cursor<User.SortKey>,
  ): Promise<Page<User>>;
  count(ctx: DbReadCtx, spec: Comp<User.Spec>): Promise<number>;
  upsert(ctx: DbWriteCtx, user: User): Promise<void>;
  delete(ctx: DbWriteCtx, spec: Comp<User.Spec>): Promise<number>;
}
