import { expect, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { LoginScreen } from "./screens/login/LoginScreen";

test.describe("Twitch API auth handling", () => {
  test("logs out when a Twitch API request returns 401", async ({ page }) => {
    await page.addInitScript(() => {
      window.__mockApiFailures = { getUsers: true };
    });
    await setupMocks(page);

    await page.goto("/");

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
        nonce: expect.any(String),
      });
  });
});
