import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@twitch-tag-inventory/server/trpc-types";

export const trpc = createTRPCReact<AppRouter>();

/** sessionStorage key for the raw bearer token (ADR 0006). */
export const SID_STORAGE_KEY = "sid";

export const getSid = (): string | null =>
  sessionStorage.getItem(SID_STORAGE_KEY);
export const setSid = (sid: string): void =>
  sessionStorage.setItem(SID_STORAGE_KEY, sid);
export const clearSid = (): void => sessionStorage.removeItem(SID_STORAGE_KEY);

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      // ADR 0006: raw session token は Authorization: Bearer で手動送信。
      // Cookie ベースではないので credentials は不要。
      headers: () => {
        const sid = getSid();
        return sid ? { authorization: `Bearer ${sid}` } : {};
      },
    }),
  ],
});
