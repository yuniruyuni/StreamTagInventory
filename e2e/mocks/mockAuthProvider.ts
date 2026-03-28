import type { AuthProvider, AuthToken } from "../../src/auth/types";

declare global {
  interface Window {
    __mockAuthToken?: string;
  }
}

type Storage = {
  set: (token: AuthToken) => void;
  remove: () => void;
};

export class MockAuthProvider implements AuthProvider {
  private token: AuthToken | null = null;
  private storage: Storage | null = null;

  constructor() {
    // Check if there's a pre-set token in window
    if (typeof window !== "undefined" && window.__mockAuthToken) {
      this.token = window.__mockAuthToken;
    }
  }

  bindStorage(storage: Storage): void {
    this.storage = storage;
  }

  getToken(): AuthToken | null {
    return this.token;
  }

  setToken(token: AuthToken): void {
    this.token = token;
    this.storage?.set(token);
  }

  clearToken(): void {
    this.token = null;
    this.storage?.remove();
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
