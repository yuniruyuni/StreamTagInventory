import { defineSpecs, type SpecsOf } from "../common";

/**
 * Yjs CRDT ドキュメントを 1 ユーザー 1 行で保持する単一行エンティティ (ADR 0004)。
 * テンプレート本体・ユーザー設定 (postTemplate) はすべて Y.Doc 内部に収まるため、
 * 個別の Template / UserSettings entity は存在しない。
 */
export interface TemplateDoc {
  userId: string;
  /** Y.encodeStateAsUpdate(doc) の結果 */
  state: Uint8Array;
  sizeBytes: number;
  updatedAt: Date;
}

export namespace TemplateDoc {
  export type SortKey = "userId";

  const _specs = defineSpecs({
    ByUserId: (userId: string) => ({ userId }),
  });
  export const ByUserId = _specs.ByUserId;

  /**
   * Spec のデータ形状 (leaf discriminated union)。
   * 合成可能な形が必要な呼出側は `Comp<TemplateDoc.Spec>` と明示する。
   */
  export type Spec = SpecsOf<typeof _specs>;

  export function cursor(
    d: TemplateDoc,
    keys: readonly SortKey[],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) result[key] = String(d[key]);
    return result;
  }
}
