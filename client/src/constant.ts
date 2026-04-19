/**
 * Twitch OAuth Client ID。authorize URL に露出する public 値。build 時に
 * `process.env.BUN_PUBLIC_TWITCH_CLIENT_ID` からインライン置換される
 * (`client/bin/build.ts` の --define allowlist 参照)。
 */
export const CLIENT_ID: string =
  process.env.BUN_PUBLIC_TWITCH_CLIENT_ID ?? "d2kz8x5se7k6b1n0picux0r7kaozi3";

/**
 * 自身の base URL。Twitch OAuth redirect_uri 構築に使う。
 */
export const APP_BASE_URL: string =
  process.env.BUN_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
