import { test } from "@playwright/test";
import { LoginScreen } from "../screens/login/LoginScreen";

test.describe("Basic Tests", () => {
  test("should load the application", async ({ page }) => {
    const loginScreen = new LoginScreen(page);

    await loginScreen.actions.goToLoginPage();
    await loginScreen.state.expectLoginPageTitle();
  });

  test("should show login screen when not authenticated", async ({ page }) => {
    const loginScreen = new LoginScreen(page);

    await loginScreen.actions.goToLoginPage();
    await loginScreen.state.expectLoginPageVisible();
  });
});