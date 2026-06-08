import { expect, type Page, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

async function openInventory(page: Page) {
  await setupMocks(page);
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return inventoryScreen;
}

test.describe("Current stream info", () => {
  test("shows a loading skeleton while channel information is loading", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__mockApiOverrides = { channelDelayMs: 1000 };
    });

    await setupMocks(page);
    await page.goto("/");

    await expect(page.getByRole("button", { name: "user menu" })).toBeVisible();
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    await expect(page.getByText("Current Stream")).toBeVisible();
  });

  test("keeps the inventory usable when channel information fails", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__mockApiFailures = { getChannels: true };
    });

    const inventoryScreen = await openInventory(page);

    await inventoryScreen.state.expectTemplateCardCount(1);
    await inventoryScreen.state.expectAddTemplateButtonVisible();
    await expect(page.getByText("Current Stream")).toBeHidden();
  });

  test("shows fallback text when stream title and category are empty", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__mockApiOverrides = {
        channel: { title: "", game_id: "", game_name: "" },
      };
    });

    await openInventory(page);

    await expect(page.getByText("No title set")).toBeVisible();
    await expect(page.getByText("No category set")).toBeVisible();
  });

  test("handles current stream info with no tags", async ({ page }) => {
    await page.addInitScript(() => {
      window.__mockApiOverrides = {
        channel: { tags: [] },
      };
    });

    const inventoryScreen = await openInventory(page);

    await expect(
      page.getByRole("button", { name: "Import as Template" }),
    ).toBeVisible();
    await inventoryScreen.actions.importCurrentStreamAsTemplate();

    await inventoryScreen.state.expectTemplateCardCount(2);
    const importedCard = inventoryScreen.getTemplateCardScreen(1);
    await importedCard.state.expectTitleValue("Test Stream Title");
    await importedCard.state.expectTagCount(0);
    await importedCard.state.expectApplyButtonDisabled();
  });
});
