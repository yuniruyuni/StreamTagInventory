import { createRemoteJWKSet } from "jose";

/**
 * Twitch OIDC の公開鍵エンドポイント。id_token の署名検証に使う。
 */
const JWKS_URL = new URL("https://id.twitch.tv/oauth2/keys");

/**
 * Process lifetime 全体で共有される Twitch JWKS。
 * jose の createRemoteJWKSet は `cacheMaxAge` 内で fetch 結果をキャッシュする。
 * 鍵ローテに追従しつつ毎リクエストの fetch は避ける設計。
 *
 * 本番では login 系 usecase から直接この singleton を使う。
 * テストでは `createLocalJWKSet` で作った別 JWKS を verifyIdToken に渡して差し替える
 * ので、この module 自体を mock する必要は無い。
 */
export const twitchJwks = createRemoteJWKSet(JWKS_URL, {
  cacheMaxAge: 60 * 60 * 1000, // 1 時間
});
