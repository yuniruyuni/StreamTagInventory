import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@twitch-tag-inventory/server/trpc-types";

export const trpc = createTRPCReact<AppRouter>();

/**
 * 現在の Twitch id_token を保持する mutable slot (ADR 0007)。
 *
 * sessionStorage への read/write は `useSession` が所有しており、trpc link は
 * このモジュールスコープの slot から最新値を読むだけ。`TwitchAuthProvider` が
 * useEffect で `setIdTokenForTrpc(idToken)` を呼んで同期する。
 *
 * こうすることで sessionStorage のシリアライズ形式 (JSON.stringify 経由か生文字列か)
 * の知識を trpc link 側に漏らさずに済む。
 */
let currentIdToken: string | null = null;

export const setIdTokenForTrpc = (token: string | null): void => {
  currentIdToken = token;
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      // ADR 0007: Twitch id_token を Authorization: Bearer で手動送信。サーバーは
      // 毎リクエスト jose で署名 / iss / aud / exp を検証して identity を resolve する。
      headers: () =>
        currentIdToken ? { authorization: `Bearer ${currentIdToken}` } : {},
    }),
  ],
});
