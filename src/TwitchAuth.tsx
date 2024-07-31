import { type FC, type ReactNode, createContext, } from "react";

import { CLIENT_ID } from "~/constant";
import { useStorage } from "~/useStorage";

export const TwitchAuthContext = createContext<AuthToken>("");

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

export const TwitchAuthProvider: FC<{ children: ReactNode }> = ({
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
    return (
      <TwitchAuthContext.Provider value={token}>
        {children}
      </TwitchAuthContext.Provider>
    );
  }

  const auth: Auth = {
    redirect_url: window.location.href,
    response_type: "token",
    scope: [
      "user:edit:broadcast",
      "channel:manage:broadcast",
      "channel_editor",
    ],
  };

  const uri = generateURI(auth);
  return <a href={uri}>Login with Twitch</a>;
};
