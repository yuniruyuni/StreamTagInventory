import type React from "react";
import { type Middleware, SWRConfig, type SWRResponse } from "swr";

export const SWRConfigWrapper: (
  // biome-ignore lint/suspicious/noExplicitAny: this any type is for testing mocks.
  response: Partial<SWRResponse<any, any>> &
    // biome-ignore lint/suspicious/noExplicitAny: this any type is for testing mocks.
    Pick<SWRResponse<any, any>, "data">,
) => React.JSXElementConstructor<{ children: React.ReactNode }> =
  (response) =>
  ({ children }) => {
    const middleware: Middleware = () => {
      // biome-ignore lint/suspicious/noExplicitAny: this any type is for testing mocks.
      return (_key, _fetcher, _options): SWRResponse<any, any> => ({
        error: undefined,
        mutate: (_) => Promise.resolve(),
        isValidating: false,
        isLoading: false,
        ...response,
      });
    };

    return <SWRConfig value={{ use: [middleware] }}>{children}</SWRConfig>;
  };
