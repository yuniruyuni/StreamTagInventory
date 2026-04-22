import { isFail } from "@/models/common";
import { LiveTemplateDoc, TemplateDoc } from "@/models/templateDoc";
import { usecase } from "@/usecases/runner";

/**
 * クライアントの state vector と optional な update を受け取り、サーバ側
 * Y.Doc にマージして差分 (server → client) を返す。push と pull を単一
 * endpoint に統合する Yjs 同期の標準パターン (ADR 0004)。
 *
 * input:
 * - userId: 権限ガード。router は `ctx.user.id` 由来で詰める (client から
 *   受け取らない)
 * - clientStateVector: client が既に持っている update の集合を要約したベクトル。
 *   サーバは「client にまだ渡していない update」だけを返す
 * - clientUpdate: client が生成した新しい update。null なら read-only sync
 *
 * output:
 * - serverUpdate: client が未知のサーバ側 update 差分 (encodeStateAsUpdate)
 * - serverStateVector: 次回 sync で client が渡す参考値
 *
 * 並行 push の直列化は Repository の `get(ByUserId)` を DbWriteCtx 経由で
 * 呼ぶことで `SELECT ... FOR UPDATE` として効く (ADR 0004 / repository.ts 参照)。
 * write phase の transaction 内で `get` → `applyUpdate` → `upsert` の順で回る。
 */
export const syncTemplateDoc = usecase({
  pre: (
    _ctx,
    input: {
      userId: string;
      clientStateVector: Uint8Array;
      clientUpdate: Uint8Array | null;
    },
  ) => {
    if (input.clientUpdate) {
      const v = LiveTemplateDoc.validateUpdateSize(input.clientUpdate);
      if (v) return v;
    }
    return input;
  },
  write: async (ctx, input) => {
    await ctx.repos.templateDoc.lockByUserId(input.userId);

    const existing = await ctx.repos.templateDoc.get(
      TemplateDoc.ByUserId(input.userId),
    );
    const live = existing
      ? LiveTemplateDoc.fromPersisted(existing)
      : LiveTemplateDoc.empty(input.userId);

    if (input.clientUpdate) {
      const applyFail = live.applyClientUpdate(input.clientUpdate);
      if (applyFail) return applyFail;

      const validateFail = live.validate();
      if (validateFail) return validateFail;

      await ctx.repos.templateDoc.upsert(live.toPersisted(ctx.now));
    }

    const diff = live.computeDiff(input.clientStateVector);
    if (isFail(diff)) return diff;
    return diff;
  },
});
