import type { Comp, Cursor, Page } from "@/models/common";
import type { Session } from "@/models/session";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface SessionRepository {
  get(ctx: DbReadCtx, spec: Comp<Session.Spec>): Promise<Session | null>;
  list(
    ctx: DbReadCtx,
    spec: Comp<Session.Spec>,
    cursor: Cursor<Session.SortKey>,
  ): Promise<Page<Session>>;
  count(ctx: DbReadCtx, spec: Comp<Session.Spec>): Promise<number>;
  upsert(ctx: DbWriteCtx, session: Session): Promise<void>;
  delete(ctx: DbWriteCtx, spec: Comp<Session.Spec>): Promise<number>;
}
