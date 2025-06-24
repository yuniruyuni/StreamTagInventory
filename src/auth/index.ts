import type { AuthProvider } from "./types";
import { TwitchAuthProvider } from "./twitch";

let authProvider: AuthProvider | null = null;

export const getAuthProvider = (storage: {
  get: () => string | null;
  set: (token: string) => void;
  remove: () => void;
}): AuthProvider => {
  if (!authProvider) {
    authProvider = new TwitchAuthProvider(storage);
  }
  return authProvider;
};

// For testing purposes
export const setAuthProvider = (provider: AuthProvider): void => {
  authProvider = provider;
};

// Re-export types
export type { AuthProvider, AuthToken } from "./types";