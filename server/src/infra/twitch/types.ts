/**
 * Twitch が発行する id_token の検証済み claims。
 * `preferred_username` / `picture` は Twitch の OIDC 拡張 claim。
 */
export interface IdTokenClaims {
  /** Twitch user id (文字列表現の数値) */
  sub: string;
  /** `"https://id.twitch.tv/oauth2"` */
  iss: string;
  /** TWITCH_CLIENT_ID */
  aud: string;
  /** Unix epoch 秒 */
  exp: number;
  iat: number;
  /** id_token mix-up 防止 nonce。ADR 0007 で client が照合する (server は不検証)。 */
  nonce?: string;
  /** Twitch のログイン名 (users.login / display_name の初期値に使う) */
  preferred_username?: string;
  /** プロフィール画像 URL (将来用) */
  picture?: string;
}
