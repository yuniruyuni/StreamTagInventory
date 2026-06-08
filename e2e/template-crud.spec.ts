import { test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

async function openInventory(page: Parameters<typeof setupMocks>[0]) {
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return inventoryScreen;
}

test.describe("Template CRUD", () => {
  test("adds an empty template with disabled apply action", async ({
    page,
  }) => {
    await setupMocks(page, { templateCount: 0 });

    const inventoryScreen = await openInventory(page);
    await inventoryScreen.state.expectTemplateCardCount(0);
    await inventoryScreen.state.expectAddTemplateButtonVisible();

    await inventoryScreen.actions.addTemplate();
    await inventoryScreen.state.expectTemplateCardCount(1);

    const newCard = inventoryScreen.getTemplateCardScreen(0);
    await newCard.state.expectTitleValue("");
    await newCard.state.expectApplyButtonDisabled();
  });

  test("clones and removes templates", async ({ page }) => {
    await setupMocks(page, { templateCount: 1 });

    const inventoryScreen = await openInventory(page);
    await inventoryScreen.state.expectTemplateCardCount(1);

    await inventoryScreen.getTemplateCardScreen(0).actions.cloneTemplate();
    await inventoryScreen.state.expectTemplateCardCount(2);
    await inventoryScreen
      .getTemplateCardScreen(1)
      .state.expectTitleValue("Test Stream Title");

    await inventoryScreen.getTemplateCardScreen(0).actions.removeTemplate();
    await inventoryScreen.state.expectTemplateCardCount(1);

    await inventoryScreen.getTemplateCardScreen(0).actions.removeTemplate();
    await inventoryScreen.state.expectTemplateCardCount(0);
    await inventoryScreen.state.expectAddTemplateButtonVisible();
  });

  test("shows dirty actions only on the edited card and can revert", async ({
    page,
  }) => {
    await setupMocks(page, { templateCount: 2 });

    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);
    const secondCard = inventoryScreen.getTemplateCardScreen(1);

    await firstCard.actions.updateTitle("Draft Title");

    await firstCard.state.expectSaveButtonVisible();
    await firstCard.state.expectRevertButtonVisible();
    await secondCard.state.expectSaveButtonHidden();
    await secondCard.state.expectRevertButtonHidden();

    await firstCard.actions.revertChanges();
    await firstCard.state.expectTitleValue("Test Stream Title");
    await firstCard.state.expectSaveButtonHidden();
    await firstCard.state.expectRevertButtonHidden();
  });
});
