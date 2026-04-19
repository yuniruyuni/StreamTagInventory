import * as Y from "yjs";
import { fail } from "@/models/common";
import { TemplateDoc } from "@/models/templateDoc";
import { usecase } from "@/usecases/runner";
import {
  validateDocShape,
  validateStateSize,
  validateUpdateSize,
} from "./shape";

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
      const v = validateUpdateSize(input.clientUpdate);
      if (v) return v;
    }
    return input;
  },
  write: async (ctx, input) => {
    // 先に advisory lock を取り、以降の get → apply → upsert 列を
    // 同一ユーザー内で直列化する (row 不在の first write 並行 race を塞ぐ)。
    await ctx.repos.templateDoc.lockByUserId(input.userId);

    const existing = await ctx.repos.templateDoc.get(
      TemplateDoc.ByUserId(input.userId),
    );
    const doc = new Y.Doc();
    if (existing) Y.applyUpdate(doc, existing.state);

    if (input.clientUpdate) {
      // client 由来の opaque binary。corrupt だと Yjs が throw するので
      // INTERNAL に落ちないよう INVALID_INPUT に変換する。
      try {
        Y.applyUpdate(doc, input.clientUpdate);
      } catch (err) {
        return fail(
          "INVALID_INPUT",
          `clientUpdate could not be applied: ${String(err)}`,
        );
      }

      const shapeFail = validateDocShape(doc);
      if (shapeFail) return shapeFail;

      const newState = Y.encodeStateAsUpdate(doc);
      const sizeFail = validateStateSize(newState);
      if (sizeFail) return sizeFail;

      await ctx.repos.templateDoc.upsert({
        userId: input.userId,
        state: newState,
        sizeBytes: newState.byteLength,
        updatedAt: ctx.now,
      });
    }

    // clientStateVector は Yjs protocol の state vector 形式を要求する
    // (= 空の Y.Doc でも encodeStateVector 結果)。空 Uint8Array は
    // decode 不能なので INVALID_INPUT として弾く。
    let serverUpdate: Uint8Array;
    try {
      serverUpdate = Y.encodeStateAsUpdate(doc, input.clientStateVector);
    } catch (err) {
      return fail(
        "INVALID_INPUT",
        `clientStateVector is malformed: ${String(err)}`,
      );
    }

    return {
      serverUpdate,
      serverStateVector: Y.encodeStateVector(doc),
    };
  },
});
