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
  // #access_token=token の形式からトークンを抽出
  const match = window.location.hash.match(/^#access_token=([^&]+)/);
  return match ? match[1] : null;
}

export function clearHash(): void {
  if (window.location.hash) {
    // document.titleが定義されていない場合に備えて空文字列を使用
    const title = document.title || "";
    window.history.replaceState("", title, window.location.pathname);
  }
}
