import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type FC, type ReactNode, useState } from "react";
import { trpc, trpcClient } from "./client";

/**
 * tRPC + React Query を App 全体に供給する。`TwitchAuthProvider` が
 * `trpc.auth.*.useMutation` / `useQuery` を使うので、その外側に置く必要がある。
 */
export const TRPCProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: false,
          },
        },
      }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
};
