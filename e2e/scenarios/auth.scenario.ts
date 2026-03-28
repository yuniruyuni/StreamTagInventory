import { test } from "@playwright/test";
import { setupMocks } from "../mocks/setupMocks";
import { setupMocksUnauthenticated } from "../mocks/setupMocksUnauthenticated";
import { NavbarScreen } from "../screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";
import { LoginScreen } from "../screens/login/LoginScreen";

test.describe("Auth Flow", () => {
  test("should show login screen when no token is present", async ({
    page,
  }) => {
    await setupMocksUnauthenticated(page);
    await page.goto("/");

    const loginScreen = new LoginScreen(page);
    await loginScreen.state.expectLoginPageVisible();
  });

  test("should display login link pointing to auth provider", async ({
    page,
  }) => {
    await setupMocksUnauthenticated(page);
    await page.goto("/");

    const loginScreen = new LoginScreen(page);
    await loginScreen.state.expectLoginPageVisible();

    // The login link should have an href (mock returns "#mock-login")
    const href = await loginScreen.elements.loginButton.getAttribute("href");
    test.expect(href).toBeTruthy();
  });

  test("should authenticate via OAuth callback with hash token", async ({
    page,
  }) => {
    await setupMocksUnauthenticated(page);
    // Simulate OAuth callback: Twitch redirects back with token in hash
    await page.goto("/#access_token=mock-oauth-token");
    await page.waitForTimeout(1000);

    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();
  });

  test("should clear hash from URL after token extraction", async ({
    page,
  }) => {
    await setupMocksUnauthenticated(page);
    await page.goto("/#access_token=mock-oauth-token");
    await page.waitForTimeout(1000);

    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();

    // Hash should be cleared after token extraction
    const url = page.url();
    const hash = new URL(url).hash;
    test.expect(hash).toBe("");
  });

  test("should redirect to login after logout", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.waitForTimeout(1000);

    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();

    // Perform logout
    const navbarScreen = new NavbarScreen(page);
    await navbarScreen.actions.logout();

    // Should redirect to login screen
    await inventoryScreen.state.expectRedirectedToLogin();

    const loginScreen = new LoginScreen(page);
    await loginScreen.state.expectLoginPageVisible();
  });

  test("should re-authenticate after logout via OAuth callback", async ({
    page,
  }) => {
    await setupMocksUnauthenticated(page);
    // First, authenticate via hash token
    await page.goto("/#access_token=mock-oauth-token");
    await page.waitForTimeout(1000);

    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();

    // Logout
    const navbarScreen = new NavbarScreen(page);
    await navbarScreen.actions.logout();
    await inventoryScreen.state.expectRedirectedToLogin();

    // Re-authenticate via OAuth callback
    await page.goto("/#access_token=new-token");
    await page.waitForTimeout(1000);

    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();
  });
});
