import { z } from "zod";
import { handleResult } from "@/presentation/trpc/handle-result";
import { protectedProcedure, router } from "@/presentation/trpc/init";
import { syncTemplateDoc } from "@/usecases/template/sync";

/**
 * Y.Doc update は BYTEA。HTTP 境界は JSON なので base64 で包む。
 * MAX_UPDATE_BYTES (= 64 KiB) を base64 膨張 (4/3) + padding 余裕で包める
 * ザックリ上限を Zod 側で早期に弾く。usecase 側の厳密チェックは別途効く。
 */
const BYTES_B64_SCHEMA = z
  .string()
  .min(0)
  .max(128 * 1024)
  .regex(/^[A-Za-z0-9+/=_-]*$/);

export const templatesRouter = router({
  /**
   * state vector + optional update を受け取り、サーバとマージした差分を返す。
   * 認証必須 + CSRF middleware が効く (mutation のため)。
   */
  sync: protectedProcedure
    .input(
      z.object({
        clientStateVector: BYTES_B64_SCHEMA,
        clientUpdate: BYTES_B64_SCHEMA.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await syncTemplateDoc.run(ctx, {
        userId: ctx.user.id,
        clientStateVector: fromBase64(input.clientStateVector),
        clientUpdate: input.clientUpdate
          ? fromBase64(input.clientUpdate)
          : null,
      });
      const value = handleResult(result);
      return {
        serverUpdate: toBase64(value.serverUpdate),
        serverStateVector: toBase64(value.serverStateVector),
      };
    }),
});

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}
