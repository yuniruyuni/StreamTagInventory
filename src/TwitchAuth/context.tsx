import { createContext } from "react";

export type AuthToken = string;

export type AuthInfo = {
  token: AuthToken;
  logout: () => void;
};

export const TwitchAuthContext = createContext<AuthInfo>({
  token: "",
  logout: () => {},
});
