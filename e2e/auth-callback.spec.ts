import { expect, test } from "@playwright/test";
import {
  makeAuthCallbackHash,
  makeAuthCallbackHashFromParams,
  makeFakeJwt,
  startUnauthenticatedLogin,
} from "./helpers/authCallback";
import { setupMocks } from "./mocks/setupMocks";
import { LoginScreen } from "./screens/login/LoginScreen";

test.describe("OAuth callback regression", () => {
  test("rejects callback when access_token or id_token is missing", async ({
    page,
  }) => {
    await setupMocks(page, { authenticated: false });
    const nonce = await startUnauthenticatedLogin(page);
    const idToken = makeFakeJwt({
      sub: "mock-twitch-user-id",
      nonce,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await page.goto(
      `/?oauth-callback=missing-access-token#${makeAuthCallbackHashFromParams({
        id_token: idToken,
        token_type: "bearer",
        expires_in: "3600",
      })}`,
    );

    const loginScreen = new LoginScreen(page);
    await loginScreen.state.expectLoginPageVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          idToken: sessionStorage.getItem("twitch-id-token"),
          accessToken: sessionStorage.getItem("twitch-auth"),
        })),
      )
      .toEqual({ idToken: null, accessToken: null });

    const rotatedNonce = await startUnauthenticatedLogin(page);
    await page.goto(
      `/?oauth-callback=missing-id-token#${makeAuthCallbackHashFromParams({
        access_token: "mock-access-token-for-e2e",
        token_type: "bearer",
        expires_in: "3600",
      })}`,
    );

    await loginScreen.state.expectLoginPageVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          idToken: sessionStorage.getItem("twitch-id-token"),
          accessToken: sessionStorage.getItem("twitch-auth"),
          nonce: localStorage.getItem("oauth_nonce"),
        })),
      )
      .toEqual({
        idToken: null,
        accessToken: null,
        nonce: rotatedNonce,
      });
  });

  test("rejects callback when id_token is malformed", async ({ page }) => {
    await setupMocks(page, { authenticated: false });
    const nonce = await startUnauthenticatedLogin(page);

    await page.goto(
      `/?oauth-callback=malformed-id-token#${makeAuthCallbackHash("not-a-jwt")}`,
    );

    const loginScreen = new LoginScreen(page);
    await loginScreen.state.expectLoginPageVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          idToken: sessionStorage.getItem("twitch-id-token"),
          accessToken: sessionStorage.getItem("twitch-auth"),
          nonce: localStorage.getItem("oauth_nonce"),
        })),
      )
      .toEqual({
        idToken: null,
        accessToken: null,
        nonce: expect.not.stringMatching(nonce),
      });
  });

  test("uses an existing valid session without showing Entrance", async ({
    page,
  }) => {
    await setupMocks(page, { authenticated: true });

    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /Login with Twitch|Twitchでログイン/ }),
    ).toBeHidden();
    await expect(page.getByRole("button", { name: "user menu" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          idToken: sessionStorage.getItem("twitch-id-token"),
          accessToken: sessionStorage.getItem("twitch-auth"),
        })),
      )
      .toEqual({
        idToken: JSON.stringify("mock-jwt-token-for-e2e"),
        accessToken: JSON.stringify("mock-access-token-for-e2e"),
      });
  });

  test("rejects callback when id_token nonce does not match", async ({
    page,
  }) => {
    await setupMocks(page, { authenticated: false });
    const originalNonce = await startUnauthenticatedLogin(page);

    const idToken = makeFakeJwt({
      sub: "mock-twitch-user-id",
      nonce: `${originalNonce}-mismatch`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await page.goto(
      `/?oauth-callback=nonce-mismatch#${makeAuthCallbackHash(idToken)}`,
    );

    const loginScreen = new LoginScreen(page);
    await loginScreen.state.expectLoginPageVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          idToken: sessionStorage.getItem("twitch-id-token"),
          accessToken: sessionStorage.getItem("twitch-auth"),
          nonce: localStorage.getItem("oauth_nonce"),
        })),
      )
      .toEqual({
        idToken: null,
        accessToken: null,
        nonce: expect.not.stringMatching(originalNonce),
      });
  });

  test("clears expired id_token and returns to Entrance", async ({ page }) => {
    await setupMocks(page, { authenticated: false });
    const nonce = await startUnauthenticatedLogin(page);

    const idToken = makeFakeJwt({
      sub: "mock-twitch-user-id",
      nonce,
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await page.goto(
      `/?oauth-callback=expired-token#${makeAuthCallbackHash(idToken)}`,
    );

    const loginScreen = new LoginScreen(page);
    await loginScreen.state.expectLoginPageVisible();
    await expect(page).toHaveURL("/");
    await expect
      .poll(() =>
        page.evaluate(() => ({
          idToken: sessionStorage.getItem("twitch-id-token"),
          accessToken: sessionStorage.getItem("twitch-auth"),
          nonce: localStorage.getItem("oauth_nonce"),
        })),
      )
      .toEqual({
        idToken: null,
        accessToken: null,
        nonce: expect.any(String),
      });
  });
});
