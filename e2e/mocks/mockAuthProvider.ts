import type { AuthProvider, AuthToken } from "../../client/src/auth/types";

declare global {
  interface Window {
    __mockAuthToken?: string;
  }
}

export class MockAuthProvider implements AuthProvider {
  private token: AuthToken | null = null;

  constructor() {
    // Check if there's a pre-set token in window
    if (typeof window !== "undefined" && window.__mockAuthToken) {
      this.token = window.__mockAuthToken;
    }
  }

  getToken(): AuthToken | null {
    return this.token;
  }

  setToken(token: AuthToken): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  shouldShowEntrance(): boolean {
    // Show entrance when not authenticated
    return this.token === null;
  }

  getEntranceUri(redirectUrl: string, scope: string[], nonce: string): string {
    const params = new URLSearchParams({
      response_type: "token id_token",
      client_id:
        process.env.BUN_PUBLIC_TWITCH_CLIENT_ID ??
        "d2kz8x5se7k6b1n0picux0r7kaozi3",
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
