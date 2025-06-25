import type { AuthProvider, AuthToken } from "../../src/auth/types";
import "../types/window";

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

  getEntranceUri(): string {
    // Mock login URL
    return "#mock-login";
  }
}
