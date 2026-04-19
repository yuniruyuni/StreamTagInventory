export interface AuthFromHash {
  accessToken: string;
  idToken: string;
}

/**
 * OIDC Implicit Hybrid callback の URL fragment から access_token + id_token を
 * 抽出する。サーバは id_token を JWKS 検証、access_token は client が
 * sessionStorage に保管して Twitch API 直接呼出に使う。
 */
export function parseAuthFromHash(): AuthFromHash | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  const idToken = params.get("id_token");
  if (!accessToken || !idToken) return null;
  return { accessToken, idToken };
}

export function clearHash(): void {
  if (window.location.hash) {
    const title = document.title || "";
    window.history.replaceState("", title, window.location.pathname);
  }
}
