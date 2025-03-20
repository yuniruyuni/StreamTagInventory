import { expect, test } from "bun:test";
import { CLIENT_ID } from "~/constant";
import { generateURI, parseTokenFromHash } from "./utils";

test("generateURI関数が正しいURIを生成する", () => {
  const auth = {
    redirect_url: "https://example.com/callback",
    response_type: "token",
    scope: ["user:read:email", "channel:read:subscriptions"],
  };

  const expectedURI = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${auth.redirect_url}&response_type=${auth.response_type}&scope=${auth.scope.join("+")}`;

  const result = generateURI(auth);
  expect(result).toBe(expectedURI);
});

test("parseTokenFromHash関数がURLハッシュからトークンを取得する", () => {
  const orig = window.location.hash;
  window.location.hash = "#access_token=mock-token&other=value";
  const result = parseTokenFromHash();
  expect(result).toBe("mock-token");
  window.location.hash = orig;
});

test("parseTokenFromHash関数がトークンがない場合はnullを返す", () => {
  const orig = window.location.hash;
  window.location.hash = "#other=value";
  const result = parseTokenFromHash();
  expect(result).toBeNull();
  window.location.hash = orig;
});
