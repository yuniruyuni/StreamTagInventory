import { expect, type Page, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

async function openInventory(page: Page, templateCount = 1) {
  await setupMocks(page, { templateCount });
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return inventoryScreen;
}

test.describe("Apply and notifications", () => {
  test("applies a template and auto-closes the success notification", async ({
    page,
  }) => {
    const inventoryScreen = await openInventory(page);
    await inventoryScreen.getTemplateCardScreen(0).actions.applyTemplate();

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Template applied successfully");
    await expect(alert).toBeHidden({ timeout: 7000 });
  });

  test("ignores stream marker failures after a successful channel update", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__mockApiFailures = { postMarkers: true };
    });

    const inventoryScreen = await openInventory(page);
    await inventoryScreen.getTemplateCardScreen(0).actions.applyTemplate();

    await expect(page.getByRole("alert")).toContainText(
      "Template applied successfully",
    );
  });

  test("shows a closable error notification for channel update failures", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__mockApiFailures = { patchChannels: true };
    });

    const inventoryScreen = await openInventory(page);
    await inventoryScreen.getTemplateCardScreen(0).actions.applyTemplate();

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Template Application Error");
    await expect(alert).toContainText("Channel update failed");
    await alert.getByRole("button", { name: "Close" }).click();
    await expect(alert).toBeHidden({ timeout: 1000 });
  });

  test("imports the current stream info as a template", async ({ page }) => {
    const inventoryScreen = await openInventory(page, 1);

    await inventoryScreen.actions.importCurrentStreamAsTemplate();

    await inventoryScreen.state.expectTemplateCardCount(2);
    await inventoryScreen
      .getTemplateCardScreen(1)
      .state.expectTitleValue("Test Stream Title");
    await expect(page.getByRole("alert")).toContainText(
      "Current stream info imported as template",
    );
  });

  test("keeps multiple notifications independently dismissible", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__mockApiFailures = { patchChannels: true };
    });
    const inventoryScreen = await openInventory(page, 1);

    await inventoryScreen.actions.importCurrentStreamAsTemplate();
    await inventoryScreen.getTemplateCardScreen(0).actions.applyTemplate();

    const alerts = page.getByRole("alert");
    await expect(alerts).toHaveCount(2);
    await expect(alerts).toContainText([
      /Current stream info imported as template/,
      /Template Application Error/,
    ]);

    await alerts
      .filter({ hasText: "Template Application Error" })
      .getByRole("button", { name: "Close" })
      .click();
    await expect(alerts).toHaveCount(1);
    await expect(alerts).toContainText(
      "Current stream info imported as template",
    );
  });
});
