import type { Comp } from "@/models/common";
import type { TemplateDoc } from "@/models/templateDoc";
import type { DbReadCtx, DbWriteCtx } from "../common";

/**
 * TemplateDoc は 1 ユーザー 1 行の単一エンティティ (ADR 0004)。
 *
 * - `list` / `count` は単一行エンティティとして意味がないため実装しない
 * - `get` を `DbWriteCtx` で呼ぶと `SELECT ... FOR UPDATE` になり、
 *   sync usecase の並行 push を直列化する
 */
export interface TemplateDocRepository {
  get(
    ctx: DbReadCtx | DbWriteCtx,
    spec: Comp<TemplateDoc.Spec>,
  ): Promise<TemplateDoc | null>;
  upsert(ctx: DbWriteCtx, doc: TemplateDoc): Promise<void>;
  delete(ctx: DbWriteCtx, spec: Comp<TemplateDoc.Spec>): Promise<number>;
}
