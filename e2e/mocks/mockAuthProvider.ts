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

  getEntranceUri(
    _redirectUrl: string,
    _scope: string[],
    _nonce: string,
  ): string {
    // Mock login URL。Bearer フロー用の e2e mock 再設計は PR 8 で行う予定。
    return "#mock-login";
  }
}
