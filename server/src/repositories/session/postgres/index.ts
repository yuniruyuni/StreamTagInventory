import type { Comp, Cursor, Page } from "@/models/common";
import type { Session } from "@/models/session";
import type { DbReadCtx, DbWriteCtx } from "@/repositories/common";
import type { SessionRepository as ISessionRepository } from "../repository";
import { count } from "./count";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class SessionRepository implements ISessionRepository {
  async get(ctx: DbReadCtx, spec: Comp<Session.Spec>): Promise<Session | null> {
    return get(ctx.db, spec);
  }
  async list(
    ctx: DbReadCtx,
    spec: Comp<Session.Spec>,
    cursor: Cursor<Session.SortKey>,
  ): Promise<Page<Session>> {
    return list(ctx.db, spec, cursor);
  }
  async count(ctx: DbReadCtx, spec: Comp<Session.Spec>): Promise<number> {
    return count(ctx.db, spec);
  }
  async upsert(ctx: DbWriteCtx, session: Session): Promise<void> {
    return upsert(ctx.db, session);
  }
  async delete(ctx: DbWriteCtx, spec: Comp<Session.Spec>): Promise<number> {
    return del(ctx.db, spec);
  }
}
