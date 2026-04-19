export type AuthToken = string;

export interface AuthProvider {
  getToken: () => AuthToken | null;
  setToken: (token: AuthToken) => void;
  clearToken: () => void;
  shouldShowEntrance: (
    paramToken: string | null,
    currentToken: AuthToken | null,
  ) => boolean;
  /**
   * Twitch authorize URL を組み立てる。`nonce` は server の
   * `auth.startNonce` から得た値を渡す (OIDC Implicit Hybrid Flow 必須)。
   */
  getEntranceUri: (
    redirectUrl: string,
    scope: string[],
    nonce: string,
  ) => string;
}
