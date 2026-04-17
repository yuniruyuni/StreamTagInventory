import type { Comp, Cursor, Page } from "@/models/common";
import type { User } from "@/models/user";
import type { DbReadCtx, DbWriteCtx } from "@/repositories/common";
import type { UserRepository as IUserRepository } from "../repository";
import { count } from "./count";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class UserRepository implements IUserRepository {
  async get(ctx: DbReadCtx, spec: Comp<User.Spec>): Promise<User | null> {
    return get(ctx.db, spec);
  }
  async list(
    ctx: DbReadCtx,
    spec: Comp<User.Spec>,
    cursor: Cursor<User.SortKey>,
  ): Promise<Page<User>> {
    return list(ctx.db, spec, cursor);
  }
  async count(ctx: DbReadCtx, spec: Comp<User.Spec>): Promise<number> {
    return count(ctx.db, spec);
  }
  async upsert(ctx: DbWriteCtx, user: User): Promise<void> {
    return upsert(ctx.db, user);
  }
  async delete(ctx: DbWriteCtx, spec: Comp<User.Spec>): Promise<number> {
    return del(ctx.db, spec);
  }
}
