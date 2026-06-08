import { expect, type Page } from "@playwright/test";
import { LoginScreen } from "../screens/login/LoginScreen";

function b64url(s: string): string {
  return Buffer.from(s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "RS256", kid: "e2e" }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.signature-not-verified`;
}

export function makeAuthCallbackHash(idToken: string): string {
  return makeAuthCallbackHashFromParams({
    access_token: "mock-access-token-for-e2e",
    id_token: idToken,
    token_type: "bearer",
    expires_in: "3600",
  });
}

export function makeAuthCallbackHashFromParams(
  params: Record<string, string>,
): string {
  const searchParams = new URLSearchParams(params);
  return searchParams.toString();
}

export async function startUnauthenticatedLogin(page: Page): Promise<string> {
  await page.goto("/");

  const loginScreen = new LoginScreen(page);
  await loginScreen.state.expectLoginPageVisible();

  const nonce = await page.evaluate(() => localStorage.getItem("oauth_nonce"));
  expect(nonce).toBeTruthy();
  return nonce ?? "";
}
