import type { Comp } from "@/models/common";
import type { TemplateDoc } from "@/models/templateDoc";
import {
  type DbReadCtx,
  type DbWriteCtx,
  isDbWriteCtx,
} from "@/repositories/common";
import type { TemplateDocRepository as ITemplateDocRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { lockByUserId } from "./lock";
import { upsert } from "./upsert";

export class TemplateDocRepository implements ITemplateDocRepository {
  async get(
    ctx: DbReadCtx | DbWriteCtx,
    spec: Comp<TemplateDoc.Spec>,
  ): Promise<TemplateDoc | null> {
    return get(ctx.db, spec, { forUpdate: isDbWriteCtx(ctx) });
  }
  async upsert(ctx: DbWriteCtx, doc: TemplateDoc): Promise<void> {
    return upsert(ctx.db, doc);
  }
  async delete(ctx: DbWriteCtx, spec: Comp<TemplateDoc.Spec>): Promise<number> {
    return del(ctx.db, spec);
  }
  async lockByUserId(ctx: DbWriteCtx, userId: string): Promise<void> {
    return lockByUserId(ctx.db, userId);
  }
}
