import type React from "react";
import { I18nextProvider } from "react-i18next";
import { type Middleware, SWRConfig, type SWRResponse } from "swr";
import i18n from "./i18n/config";

export const I18nWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};

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

    return (
      <I18nWrapper>
        <SWRConfig value={{ use: [middleware] }}>{children}</SWRConfig>
      </I18nWrapper>
    );
  };
