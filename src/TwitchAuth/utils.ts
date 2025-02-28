import { CLIENT_ID } from "~/constant";

export type Auth = {
  redirect_url: string;
  response_type: string;
  scope: string[];
};

export function generateURI(auth: Auth): string {
  const url = "https://id.twitch.tv/oauth2/authorize";
  const scope = auth.scope.join("+");
  return `${url}?client_id=${CLIENT_ID}&redirect_uri=${auth.redirect_url}&response_type=${auth.response_type}&scope=${scope}`;
}

export function parseTokenFromHash(): string | null {
  const param = Object.fromEntries(new URLSearchParams(window.location.hash));
  return param["#access_token"] || null;
}

export function clearHash(): void {
  if (window.location.hash) {
    window.history.replaceState("", document.title, window.location.pathname);
  }
}
