import { type FC, type ReactNode, createContext, } from "react";
import { SWRConfig } from "swr";

import { CLIENT_ID } from "~/constant";
import { useStorage } from "~/useStorage";

export const TwitchAuthContext = createContext<AuthInfo>({
  token: "",
  logout: () => {},
});

type AuthInfo = {
  token: AuthToken;
  logout: () => void;
};

type AuthToken = string;

type Auth = {
  redirect_url: string;
  response_type: string;
  scope: string[];
};

function generateURI(auth: Auth) {
  const url = "https://id.twitch.tv/oauth2/authorize";
  const scope = auth.scope.join("+");
  return `${url}?client_id=${CLIENT_ID}&redirect_uri=${auth.redirect_url}&response_type=${auth.response_type}&scope=${scope}`;
}

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
  const [token, setToken] = useStorage<AuthToken>("twitch-auth", "");

  const param = Object.fromEntries(new URLSearchParams(window.location.hash));
  const paramToken = param["#access_token"];

  if (paramToken && paramToken !== "") {
    setToken(paramToken);

    if (window.location.hash) {
      window.history.replaceState("", document.title, window.location.pathname);
    }
    return <>reloading...</>;
  }

  if (token && token !== "") {
    const logout = () => { setToken("") };
    return (
      <TwitchAuthContext.Provider value={{token, logout}} >
        <SWRConfig value={{
          onError: (err) => {
            try {
              const parsed = JSON.parse(err);
              if (parsed.status === 401) {
                logout();
              }
            } catch {
              logout();
            }
          },
        }}>
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
