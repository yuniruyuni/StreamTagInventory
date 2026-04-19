import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@twitch-tag-inventory/server/trpc-types";

export const trpc = createTRPCReact<AppRouter>();

/** ADR 0007: Twitch id_token を sessionStorage に保管し Bearer として送信する */
export const ID_TOKEN_STORAGE_KEY = "twitch-id-token";

export const getIdToken = (): string | null =>
  sessionStorage.getItem(ID_TOKEN_STORAGE_KEY);
export const setIdToken = (token: string): void =>
  sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, token);
export const clearIdToken = (): void =>
  sessionStorage.removeItem(ID_TOKEN_STORAGE_KEY);

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      // ADR 0007: Twitch id_token を Authorization: Bearer で手動送信。サーバーは
      // 毎リクエスト jose で署名 / iss / aud / exp を検証して identity を resolve する。
      headers: () => {
        const idToken = getIdToken();
        return idToken ? { authorization: `Bearer ${idToken}` } : {};
      },
    }),
  ],
});
