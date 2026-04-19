export interface AuthFromHash {
  accessToken: string;
  idToken: string;
}

/**
 * OIDC Implicit Hybrid callback の URL fragment から access_token + id_token を
 * 抽出する。サーバは ADR 0007 に従い id_token を毎リクエスト Bearer で受け取り
 * jose で検証する。client は access_token を sessionStorage に保管して
 * Twitch API 直接呼出に使う。
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

/**
 * id_token (JWT) の payload セグメントだけを base64url decode して `nonce` claim を
 * 抜く。**署名検証は行わない** (それはサーバー側の責務、ADR 0007)。
 *
 * 用途は client local の nonce 照合のみ — sessionStorage に保管した nonce と、
 * id_token claim の nonce を文字列比較して mix-up 攻撃を防ぐ。
 *
 * 失敗 (parse 不能 / claim 欠如) は null を返す。呼出側は「null = 不正」として
 * callback を reject する。
 */
export function peekIdTokenNonce(idToken: string): string | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1];
    // base64url → base64 + padding 復元
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const json = atob(padded);
    const claims = JSON.parse(json) as { nonce?: unknown };
    return typeof claims.nonce === "string" ? claims.nonce : null;
  } catch {
    return null;
  }
}

/**
 * OIDC nonce を CSPRNG で発行する。`crypto.randomUUID` は 122bit のエントロピーが
 * あり、replay 防止 / mix-up 防止には十分。文字列形式は authorize URL の query
 * パラメータにそのまま入れられる ASCII safe な値。
 */
export function generateNonce(): string {
  return crypto.randomUUID();
}
