import type { FC, ReactNode } from "react";
import { SWRConfig } from "swr";
import { useSession } from "~/useStorage";
import { type AuthToken, TwitchAuthContext } from "./context";
import { type Auth, clearHash, generateURI, parseTokenFromHash } from "./utils";

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

  // E2E test mode: bypass authentication
  if (typeof window !== "undefined" && window.E2E_TEST_MODE) {
    const testToken = window.E2E_TEST_TOKEN || "test-token";
    
    // Set token in state if not already set
    if (!token && testToken) {
      setToken(testToken);
      return <>Setting up test environment...</>;
    }
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
