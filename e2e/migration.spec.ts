import { expect, type Page, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { NavbarScreen } from "./screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

const legacyTemplate = {
  id: "legacy-template-1",
  title: "Legacy Stream Title",
  category: {
    id: "21779",
    name: "League of Legends",
    box_art_url:
      "https://static-cdn.jtvnw.net/ttv-boxart/21779-{width}x{height}.jpg",
  },
  tags: ["Legacy", "Imported"],
};

async function openWithLegacy(
  page: Page,
  {
    templateCount = 0,
    migratedAt = null,
  }: { templateCount?: number; migratedAt?: string | null } = {},
) {
  await setupMocks(page, {
    templateCount,
    migratedAt,
    legacyTemplates: [legacyTemplate],
    legacyPostTemplate: "Legacy post {title}",
  });
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return inventoryScreen;
}

test.describe("Legacy migration", () => {
  test("shows the migration prompt when legacy storage exists", async ({
    page,
  }) => {
    await openWithLegacy(page);

    const dialog = page
      .getByRole("dialog")
      .filter({ hasText: "Move templates to the server" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("1 templates");
    await expect(dialog).toContainText("Custom post template");
  });

  test("migrates legacy templates into the synced document", async ({
    page,
  }) => {
    const inventoryScreen = await openWithLegacy(page);

    await page.getByRole("button", { name: "Migrate" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("alert")).toContainText("Migration complete");
    await inventoryScreen.state.expectTemplateCardCount(1);
    await inventoryScreen
      .getTemplateCardScreen(0)
      .state.expectTitleValue("Legacy Stream Title");
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("templates_migrated_at")),
      )
      .toEqual(expect.any(String));

    const navbarScreen = new NavbarScreen(page);
    await navbarScreen.actions.openPostTemplateEditor();
    await expect(
      page.getByRole("textbox", { name: "Post Template" }),
    ).toHaveValue("Legacy post {title}");
  });

  test("keeps legacy data and shows the prompt again after Later and reload", async ({
    page,
  }) => {
    await openWithLegacy(page);

    await page.getByRole("button", { name: "Later" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          migratedAt: localStorage.getItem("templates_migrated_at"),
          templates: localStorage.getItem("templates"),
        })),
      )
      .toEqual({
        migratedAt: null,
        templates: expect.any(String),
      });

    await page.reload();
    await new InventoryScreen(page).actions.waitForAuthentication();
    await expect(
      page
        .getByRole("dialog")
        .filter({ hasText: "Move templates to the server" }),
    ).toBeVisible();
  });

  test("does not show the prompt when remote templates already exist", async ({
    page,
  }) => {
    const inventoryScreen = await openWithLegacy(page, { templateCount: 1 });

    await expect(page.getByRole("dialog")).toBeHidden();
    await inventoryScreen.state.expectTemplateCardCount(1);
    await inventoryScreen
      .getTemplateCardScreen(0)
      .state.expectTitleValue("Test Stream Title");
  });

  test("cleans up retained legacy storage after the retention period", async ({
    page,
  }) => {
    await openWithLegacy(page, { migratedAt: "2000-01-01T00:00:00.000Z" });

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          migratedAt: localStorage.getItem("templates_migrated_at"),
          templates: localStorage.getItem("templates"),
          postTemplate: localStorage.getItem("postTemplate"),
        })),
      )
      .toEqual({
        migratedAt: null,
        templates: null,
        postTemplate: null,
      });
  });
});
