export type AuthToken = string;

export interface AuthProvider {
  getToken: () => AuthToken | null;
  setToken: (token: AuthToken) => void;
  clearToken: () => void;
  shouldShowEntrance: (paramToken: string | null, currentToken: AuthToken | null) => boolean;
  getEntranceUri: (redirectUrl: string, scope: string[]) => string;
}