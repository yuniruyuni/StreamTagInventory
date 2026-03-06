import { test } from "@playwright/test";
import { waitForCSS } from "../helpers/waitForCSS";
import { setupMocks } from "../mocks/setupMocks";
import { NavbarScreen } from "../screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";
import { LoginScreen } from "../screens/login/LoginScreen";

test.describe("Visual Regression Tests - Unauthenticated", () => {
  test("login page", async ({ page }) => {
    const loginScreen = new LoginScreen(page);

    await loginScreen.actions.goToLoginPage();
    await loginScreen.state.expectLoginPageVisible();

    await loginScreen.actions.waitForLoadState("domcontentloaded");
    await loginScreen.actions.waitForLoadState("networkidle");
    await waitForCSS(page);

    await loginScreen.state.expectScreenshot("login-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});

test.describe("Visual Regression Tests - Authenticated", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");

    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForLoadState("domcontentloaded");
    await inventoryScreen.actions.waitForLoadState("networkidle");
    await inventoryScreen.actions.waitForAuthentication();

    await waitForCSS(page);
  });

  test("main inventory page", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForLoadState("networkidle");

    await inventoryScreen.state.expectScreenshot("main-inventory-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("template card", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    const firstTemplateCard = inventoryScreen.getTemplateCardScreen(0);

    await page.getByRole("article").first().waitFor({ state: "visible" });
    await firstTemplateCard.state.expectCardScreenshot("template-card.png");
  });

  test("category dropdown open", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    const firstTemplateCard = inventoryScreen.getTemplateCardScreen(0);

    await firstTemplateCard.elements.categoryInput.click();
    await firstTemplateCard.actions.waitForCategoryDropdown();

    await firstTemplateCard.state.expectCardScreenshot("category-dropdown.png");
  });

  test("tag input interface", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    const firstTemplateCard = inventoryScreen.getTemplateCardScreen(0);

    await firstTemplateCard.state.expectCardScreenshot("tag-input.png");
  });

  test("user menu dropdown", async ({ page }) => {
    const navbarScreen = new NavbarScreen(page);

    await navbarScreen.actions.openUserMenu();
    await navbarScreen.state.expectNavbarScreenshot("user-menu-dropdown.png");
  });

  test("template with changes", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    const firstTemplateCard = inventoryScreen.getTemplateCardScreen(0);

    await firstTemplateCard.actions.updateTitle("Modified Title");
    await firstTemplateCard.state.expectSaveButtonVisible();

    await firstTemplateCard.state.expectCardScreenshot(
      "template-card-modified.png",
    );
  });
});

test.describe("Visual Regression Tests - Responsive", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");

    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForLoadState("domcontentloaded");
    await inventoryScreen.actions.waitForLoadState("networkidle");
    await inventoryScreen.actions.waitForAuthentication();

    await waitForCSS(page);
  });

  test("mobile viewport", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);

    await inventoryScreen.actions.setViewportSize({ width: 375, height: 667 });
    await inventoryScreen.actions.waitForTimeout(500);

    await inventoryScreen.state.expectScreenshot("mobile-view.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("tablet viewport", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);

    await inventoryScreen.actions.setViewportSize({ width: 768, height: 1024 });
    await inventoryScreen.actions.waitForTimeout(500);

    await inventoryScreen.state.expectScreenshot("tablet-view.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
