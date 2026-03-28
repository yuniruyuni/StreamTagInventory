import type { FC, ReactNode } from "react";
import { SWRConfig } from "swr";
import { getAuthProvider } from "~/auth";
import { useSession } from "~/useStorage";
import { type AuthToken, TwitchAuthContext } from "./context";
import { clearHash, parseTokenFromHash } from "./utils";

type Props = {
  scope: string[];
  entrance: (uri: string) => ReactNode;
  children: ReactNode;
};

export const TwitchAuthProvider: FC<Props> = ({
  scope,
  entrance,
  children,
}) => {
  const [token, setToken, removeToken, isHydrated] = useSession<AuthToken>(
    "twitch-auth",
    "",
  );

  const authProvider = getAuthProvider({
    get: () => token,
    set: setToken,
    remove: removeToken,
  });

  const paramToken = parseTokenFromHash();

  if (paramToken && paramToken !== "") {
    authProvider.setToken(paramToken);
    clearHash();
    return <>reloading...</>;
  }

  if (!isHydrated) return null;

  if (!authProvider.shouldShowEntrance(paramToken, token)) {
    const logout = () => {
      authProvider.clearToken();
    };
    return (
      <TwitchAuthContext.Provider value={{ token: token || "", logout }}>
        <SWRConfig
          value={{
            onError: (err) => {
              console.log(err);
              if (err.status === 401) {
                logout();
              }
            },
          }}
        >
          {children}
        </SWRConfig>
      </TwitchAuthContext.Provider>
    );
  }

  const uri = authProvider.getEntranceUri(window.location.href, scope);
  return entrance(uri);
};
