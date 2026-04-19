import { CLIENT_ID } from "~/constant";
import type { AuthProvider, AuthToken } from "./types";

export class TwitchAuthProvider implements AuthProvider {
  constructor(
    private storage: {
      get: () => AuthToken | null;
      set: (token: AuthToken) => void;
      remove: () => void;
    },
  ) {}

  getToken(): AuthToken | null {
    return this.storage.get();
  }

  setToken(token: AuthToken): void {
    this.storage.set(token);
  }

  clearToken(): void {
    this.storage.remove();
  }

  shouldShowEntrance(
    paramToken: string | null,
    currentToken: AuthToken | null,
  ): boolean {
    // If we have a token from URL params, we're in the process of authenticating
    if (paramToken) {
      return false;
    }
    // Show entrance if no current token
    return !currentToken || currentToken === "";
  }

  getEntranceUri(redirectUrl: string, scope: string[], nonce: string): string {
    // Implicit Hybrid: access_token (Twitch API 用) と id_token (server 識別用)
    // を同時に取る。openid scope + nonce は OIDC 仕様上必須。
    const params = new URLSearchParams({
      response_type: "token id_token",
      client_id: CLIENT_ID,
      redirect_uri: redirectUrl,
      scope: ["openid", ...scope].join(" "),
      nonce,
      claims: JSON.stringify({
        id_token: { preferred_username: null },
      }),
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }
}
