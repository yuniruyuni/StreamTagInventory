import { OidcNonce } from "@/models/oidcNonce";
import { usecase } from "@/usecases/runner";

/**
 * クライアントが Twitch OIDC authorize URL に埋め込むための one-time nonce を
 * 発行する。`oidc_nonces` テーブルに保存し、auth.login で atomic consume
 * (delete ByValue AND ActiveAt) して検証する。
 *
 * 入力なし。呼出は `startNonce.run(ctx)`。nonce 値は `OidcNonce.create` が
 * CSPRNG で自動発行、TTL は `OidcNonce.TTL_MS` が支配する。結果は発行した
 * `OidcNonce` Model (presentation 層が必要な `nonce` 値だけを抜く)。
 */
export const startNonce = usecase({
  process: (ctx) => OidcNonce.create({ now: ctx.now }),
  write: async (ctx, model) => {
    await ctx.repos.oidcNonce.upsert(model);
    return model;
  },
});
