import type { AuthProvider, AuthToken } from "../../src/auth/types";

export class MockAuthProvider implements AuthProvider {
  private token: AuthToken | null = "test-token";

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
    // Always authenticated in tests
    return false;
  }

  getEntranceUri(): string {
    // Not used in tests
    return "#";
  }
}