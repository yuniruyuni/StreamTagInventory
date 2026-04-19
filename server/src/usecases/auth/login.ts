import { verifyIdToken } from "@/infra/twitch/verify-id-token";
import { and, fail, Token } from "@/models/common";
import { OidcNonce } from "@/models/oidcNonce";
import { Session } from "@/models/session";
import { User } from "@/models/user";
import { usecase } from "@/usecases/runner";

/**
 * Twitch id_token を検証し、対応する user を upsert + 新しい session を作成する。
 *
 * - 入力は HTTP 由来の primitive (`idToken` / `nonce`)。`login.run(ctx, input)` で渡す
 * - TWITCH_CLIENT_ID / JWKS などの infra 設定は `ctx.twitch` 経由
 * - 結果は `{ user, session, rawSessionToken }`。`rawSessionToken` は cookie
 *   に載せるための raw bearer token (base64url)。ADR 0005 に従い DB には
 *   `sha256(raw)` を `session.tokenHash` として保存するのみで、raw は応答後に
 *   サーバ側から消える。presentation 層はこの raw を `__Host-sid` cookie に
 *   セットする責務を持つ
 */
export const login = usecase({
  pre: (
    _ctx,
    input: {
      /** Twitch から受け取った id_token (JWT) */
      idToken: string;
      /** クライアントが authorize URL に埋め込んだ nonce (startNonce 発行済のもの) */
      nonce: string;
    },
  ) => {
    if (!input.idToken) return fail("INVALID_INPUT", "idToken is required");
    if (!input.nonce) return fail("INVALID_INPUT", "nonce is required");
    return input;
  },
  write: async (ctx, { idToken, nonce: nonceString }) => {
    // HTTP 入力の base64url 文字列を raw bytes の Token に戻す。id_token 検証は
    // Twitch claim 側が string なので nonceString のまま渡す。
    const nonceToken = Token.fromBase64url(nonceString);

    // 1. nonce を atomic に consume する。
    //    DELETE WHERE nonce = ? AND expires_at > now() の影響行数で判定。
    //
    //    runner の transaction は「throw」でのみ rollback し、Fail 値の return
    //    は COMMIT 扱い (infra/db/pg-client.ts 参照)。このため verify 失敗で
    //    Fail を return しても nonce の DELETE は確定する = リプレイ封じ込め。
    //    成功系でも同様で、user.upsert / session.upsert まで全て commit される。
    const consumedRows = await ctx.repos.oidcNonce.delete(
      and(OidcNonce.ByValue(nonceToken), OidcNonce.ActiveAt(ctx.now)),
    );
    if (consumedRows === 0) {
      return fail("INVALID_INPUT", "nonce is unknown or expired");
    }

    // 2. id_token を検証 (署名 + iss + aud + exp + nonce claim 一致)
    const verifyResult = await verifyIdToken(idToken, ctx.twitch.jwks, {
      expectedAudience: ctx.twitch.clientId,
      expectedNonce: nonceString,
    });
    if (!verifyResult.ok) return verifyResult.error;
    const claims = verifyResult.value;

    // 3. user を取得 or 新規作成。upsert で last_login_at / login / display_name を更新。
    const existing = await ctx.repos.user.get(User.ByTwitchUserId(claims.sub));
    const user: User = existing
      ? {
          ...existing,
          login: claims.preferred_username ?? existing.login,
          displayName: claims.preferred_username ?? existing.displayName,
          updatedAt: ctx.now,
          lastLoginAt: ctx.now,
        }
      : User.create({
          twitchUserId: claims.sub,
          login: claims.preferred_username ?? "",
          displayName: claims.preferred_username ?? "",
          now: ctx.now,
        });
    await ctx.repos.user.upsert(user);

    // 4. session を新規作成。
    //    - bearer token: ADR 0005 に従い raw を発行し、DB には sha256 だけ置く。
    //      raw は戻り値で 1 度だけ presentation 層に渡し、以降サーバから消える。
    //    - CSRF token: Session.create が CSPRNG で自動発行。Cookie には出さず
    //      client が memory 保持する (XSS 耐性)。
    //    - TTL は Session.TTL_MS が支配する (ドメイン定数)。
    const rawSessionToken = Token.generate();
    const session = Session.create({
      userId: user.id,
      tokenHash: rawSessionToken.hash(),
      now: ctx.now,
    });
    await ctx.repos.session.upsert(session);

    return {
      user,
      session,
      rawSessionToken: rawSessionToken.toBase64url(),
    } satisfies { user: User; session: Session; rawSessionToken: string };
  },
});
