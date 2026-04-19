import { createContext } from "react";

export type AuthToken = string;

export interface AuthUser {
  id: string;
  twitchUserId: string;
  login: string;
  displayName: string;
}

export interface AuthInfo {
  /** Twitch access_token。Twitch API 直接呼出用 (sessionStorage 経由)。 */
  token: AuthToken;
  /** server 解決済の identity (auth.me の応答)。未ログインは null */
  user: AuthUser | null;
  logout: () => Promise<void>;
}

export const TwitchAuthContext = createContext<AuthInfo>({
  token: "",
  user: null,
  logout: async () => {},
});
