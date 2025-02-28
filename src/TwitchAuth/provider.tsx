import type { FC, ReactNode } from "react";
import { SWRConfig } from "swr";
import { useSession } from "~/useSession";
import { type AuthToken, TwitchAuthContext } from "./context";
import { type Auth, clearHash, generateURI, parseTokenFromHash } from "./utils";

export type EntranceProps = {
  uri: string;
};

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
  const [token, setToken] = useSession<AuthToken>("twitch-auth", "");

  const paramToken = parseTokenFromHash();

  if (paramToken && paramToken !== "") {
    setToken(paramToken);
    clearHash();
    return <>reloading...</>;
  }

  if (token && token !== "") {
    const logout = () => {
      setToken("");
    };
    return (
      <TwitchAuthContext.Provider value={{ token, logout }}>
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

  const auth: Auth = {
    redirect_url: window.location.href,
    response_type: "token",
    scope: scope,
  };

  const uri = generateURI(auth);
  return entrance(uri);
};
