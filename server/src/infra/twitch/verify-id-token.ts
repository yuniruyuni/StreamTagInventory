import { type JWTVerifyGetKey, jwtVerify } from "jose";
import { type Fail, fail, type Result } from "@/models/common";
import type { IdTokenClaims } from "./types";

const TWITCH_ISSUER = "https://id.twitch.tv/oauth2";

export interface VerifyOptions {
  /** TWITCH_CLIENT_ID (aud claim と一致する値) */
  expectedAudience: string;
}

/**
 * Twitch の id_token を検証して verified claims を返す。
 *
 * - `jwtVerify` が iss / aud / exp / 署名を検証する
 * - nonce は ADR 0007 により client 側で照合する責務 (server では検証しない)
 * - 失敗時の details には token 本体を入れない (ログ漏洩防止)
 *
 * `jwks` を引数で受け取ることでテストでは `createLocalJWKSet` した
 * ローカル鍵セットを渡せる。本番は `twitchJwks` singleton を注入する。
 */
export async function verifyIdToken(
  idToken: string,
  jwks: JWTVerifyGetKey,
  options: VerifyOptions,
): Promise<Result<IdTokenClaims, Fail>> {
  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: TWITCH_ISSUER,
      audience: options.expectedAudience,
    });

    if (typeof payload.sub !== "string") {
      return {
        ok: false,
        error: fail("INVALID_INPUT", "id_token missing sub"),
      };
    }

    return {
      ok: true,
      value: {
        sub: payload.sub,
        iss: payload.iss as string,
        aud: Array.isArray(payload.aud)
          ? (payload.aud[0] as string)
          : (payload.aud as string),
        exp: payload.exp as number,
        iat: payload.iat as number,
        nonce: typeof payload.nonce === "string" ? payload.nonce : undefined,
        preferred_username:
          typeof payload.preferred_username === "string"
            ? payload.preferred_username
            : undefined,
        picture:
          typeof payload.picture === "string" ? payload.picture : undefined,
      },
    };
  } catch (e) {
    // cause にはエラーメッセージのみ、idToken 本体は絶対に入れない
    return {
      ok: false,
      error: fail("INVALID_INPUT", "id_token verification failed", {
        cause: e instanceof Error ? e.message : String(e),
      }),
    };
  }
}
