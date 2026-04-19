import type { Comp } from "@/models/common";
import type { TemplateDoc } from "@/models/templateDoc";
import type { DbReadCtx, DbWriteCtx } from "../common";

/**
 * TemplateDoc は 1 ユーザー 1 行の単一エンティティ (ADR 0004)。
 *
 * - `list` / `count` は単一行エンティティとして意味がないため実装しない
 * - `get` を `DbWriteCtx` で呼ぶと `SELECT ... FOR UPDATE` になる (row 存在時のみ)
 * - `lockByUserId` は FOR UPDATE では塞げない「first write の並行 INSERT」race
 *   を advisory lock で直列化する (後述)
 */
export interface TemplateDocRepository {
  get(
    ctx: DbReadCtx | DbWriteCtx,
    spec: Comp<TemplateDoc.Spec>,
  ): Promise<TemplateDoc | null>;
  upsert(ctx: DbWriteCtx, doc: TemplateDoc): Promise<void>;
  delete(ctx: DbWriteCtx, spec: Comp<TemplateDoc.Spec>): Promise<number>;
  /**
   * 指定ユーザーに対して transaction-scoped の advisory lock を取る。
   * 同じ userId で lock を取っている別 tx を直列化する。commit/rollback で
   * 自動解放。sync usecase の write phase 冒頭で呼び、以後の
   * get → apply → upsert 列を並行から保護する。
   *
   * spec/標準メソッドではなく固有メソッドとして置くのは、これが「data query」
   * でなく「transaction control primitive」で役割が異なるため。
   */
  lockByUserId(ctx: DbWriteCtx, userId: string): Promise<void>;
}
