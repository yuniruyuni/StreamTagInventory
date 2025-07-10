import { test } from "@playwright/test";
import { setupMocks } from "../mocks/setupMocks";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";
import { NavbarScreen } from "../screens/components/navbar/NavbarScreen";

test.beforeEach(async ({ page }) => {
  await setupMocks(page);
  await page.goto("/");
  await page.waitForTimeout(1000);

  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
});

test.describe("Authenticated User Flow", () => {
  test("should show main inventory page when authenticated", async ({
    page,
  }) => {
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.state.expectInventoryPageVisible();
  });

  test("should show current channel information", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForLoadState("networkidle");

    const firstTemplateCard = inventoryScreen.getTemplateCardScreen(0);
    await firstTemplateCard.state.expectCategoryValue("Just Chatting");
    await firstTemplateCard.state.expectTitleValue("Test Stream Title");
  });

  test("should allow searching for categories", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    const firstTemplateCard = inventoryScreen.getTemplateCardScreen(0);

    await firstTemplateCard.actions.searchCategory("League");
    await firstTemplateCard.state.expectCategoryDropdownVisible();
    await firstTemplateCard.state.expectCategoryOptionVisible(
      "League of Legends",
    );
  });

  test("should allow updating channel information", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForLoadState("networkidle");

    const firstTemplateCard = inventoryScreen.getTemplateCardScreen(0);

    await firstTemplateCard.actions.updateTitle("New Stream Title");
    await firstTemplateCard.actions.saveTemplate();
    await firstTemplateCard.actions.applyTemplate();

    await firstTemplateCard.state.expectTitleValue("New Stream Title");
  });

  test("should display tags in template cards", async ({ page }) => {
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForLoadState("networkidle");

    const firstTemplateCard = inventoryScreen.getTemplateCardScreen(0);
    await firstTemplateCard.state.expectTagsVisible();
  });

  test("should allow logout", async ({ page }) => {
    const navbarScreen = new NavbarScreen(page);
    const inventoryScreen = new InventoryScreen(page);

    await navbarScreen.actions.logout();
    await inventoryScreen.state.expectRedirectedToLogin();
  });
});