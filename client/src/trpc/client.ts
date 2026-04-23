import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@twitch-tag-inventory/server/trpc-types";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Twitch id_token を sessionStorage に保管するキー (ADR 0007)。
 * `TwitchAuthProvider` の `useSession` と、本 module の `headers()` で共有する。
 */
export const ID_TOKEN_STORAGE_KEY = "twitch-id-token";

/**
 * sessionStorage から Twitch id_token を同期的に読む。`useSession` 経由で
 * JSON.stringify されて書かれているので JSON.parse で unwrap する。
 *
 * **なぜ module-level slot ではなく毎回 sessionStorage を読むのか**:
 * かつては `currentIdToken` という mutable slot + `setIdTokenForTrpc` setter で
 * provider の useEffect から同期していたが、初回ログイン直後に
 *   1. Phase A が setIdToken で state 更新 queue
 *   2. React が re-render、useQuery が enable 化されて fetch を commit 内で schedule
 *   3. provider の useEffect (`setIdTokenForTrpc`) が passive effect として commit 後に走る
 *   4. 既に schedule 済の fetch が先に microtask で発火 → `headers()` は古い slot (null) を読み Bearer 無しで送信 → `auth.me` 401
 * という race が発生していた (「初回ログインで Entrance に弾かれる」症状)。
 *
 * `useSession` の setter は `storage.setItem` を同期的に実行するため、
 * `headers()` で直接 sessionStorage を読めば fetch 発行タイミングに依存せず
 * 最新 token が得られる。
 */
export function readIdToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ID_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      // ADR 0007: Twitch id_token を Authorization: Bearer で手動送信。サーバーは
      // 毎リクエスト jose で署名 / iss / aud / exp を検証して identity を resolve する。
      headers: () => {
        const token = readIdToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
