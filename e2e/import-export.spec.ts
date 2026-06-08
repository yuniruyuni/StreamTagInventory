import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { NavbarScreen } from "./screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

const importedTemplate = {
  id: "imported-template-1",
  title: "Imported Stream Title",
  category: {
    id: "21779",
    name: "League of Legends",
    box_art_url:
      "https://static-cdn.jtvnw.net/ttv-boxart/21779-{width}x{height}.jpg",
  },
  tags: ["English", "Tutorial"],
};

async function openInventory(page: Page, templateCount: number) {
  await setupMocks(page, { templateCount });
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return {
    inventoryScreen,
    navbarScreen: new NavbarScreen(page),
  };
}

async function importJson(
  page: Page,
  navbarScreen: NavbarScreen,
  name: string,
  json: string,
) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await navbarScreen.actions.importTemplates();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
}

test.describe("Import and export", () => {
  test("exports templates as JSON", async ({ page }, testInfo) => {
    const { navbarScreen } = await openInventory(page, 2);

    const downloadPromise = page.waitForEvent("download");
    await navbarScreen.actions.exportTemplates();
    const download = await downloadPromise;
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);

    const exported = JSON.parse(await readFile(path, "utf8")) as unknown[];
    expect(download.suggestedFilename()).toBe("templates.json");
    expect(exported).toHaveLength(2);
    expect(exported[0]).toMatchObject({
      id: "test-template-1",
      title: "Test Stream Title",
      category: { name: "Just Chatting" },
      tags: ["English", "Gaming"],
    });
  });

  test("exports an empty template list as an empty JSON array", async ({
    page,
  }, testInfo) => {
    const { inventoryScreen, navbarScreen } = await openInventory(page, 0);
    await inventoryScreen.state.expectTemplateCardCount(0);

    const downloadPromise = page.waitForEvent("download");
    await navbarScreen.actions.exportTemplates();
    const download = await downloadPromise;
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);

    const exported = JSON.parse(await readFile(path, "utf8")) as unknown[];
    expect(download.suggestedFilename()).toBe("templates.json");
    expect(exported).toEqual([]);
  });

  test("imports new templates and skips duplicate ids", async ({ page }) => {
    const { inventoryScreen, navbarScreen } = await openInventory(page, 1);
    await inventoryScreen.state.expectTemplateCardCount(1);

    await importJson(
      page,
      navbarScreen,
      "templates.json",
      JSON.stringify([
        { ...importedTemplate, id: "test-template-1", title: "Duplicate" },
        importedTemplate,
      ]),
    );

    await inventoryScreen.state.expectTemplateCardCount(2);
    await inventoryScreen
      .getTemplateCardScreen(0)
      .state.expectTitleValue("Test Stream Title");
    await inventoryScreen
      .getTemplateCardScreen(1)
      .state.expectTitleValue(importedTemplate.title);
    await expect(page.getByRole("alert")).toContainText("1 templates");

    await importJson(
      page,
      navbarScreen,
      "duplicate.json",
      JSON.stringify([{ ...importedTemplate, id: "test-template-1" }]),
    );

    await inventoryScreen.state.expectTemplateCardCount(2);
  });

  test("keeps existing templates and shows an error for invalid imports", async ({
    page,
  }) => {
    const { inventoryScreen, navbarScreen } = await openInventory(page, 1);

    await importJson(page, navbarScreen, "invalid.json", "not json");

    await inventoryScreen.state.expectTemplateCardCount(1);
    await expect(page.getByRole("alert")).toContainText(
      "Template Import Error",
    );
  });

  test("treats an empty JSON import as a valid no-op", async ({ page }) => {
    const { inventoryScreen, navbarScreen } = await openInventory(page, 1);

    await importJson(page, navbarScreen, "empty.json", "[]");

    await inventoryScreen.state.expectTemplateCardCount(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("keeps existing templates when the file chooser is cancelled", async ({
    page,
  }) => {
    const { inventoryScreen, navbarScreen } = await openInventory(page, 1);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await navbarScreen.actions.importTemplates();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([]);

    await inventoryScreen.state.expectTemplateCardCount(1);
    await inventoryScreen
      .getTemplateCardScreen(0)
      .state.expectTitleValue("Test Stream Title");
    await expect(page.getByRole("alert")).toContainText(
      "Template Import Error",
    );
  });
});
