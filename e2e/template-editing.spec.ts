import { expect, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { NavbarScreen } from "./screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

async function openInventory(page: Parameters<typeof setupMocks>[0]) {
  await setupMocks(page, { templateCount: 3 });
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return inventoryScreen;
}

test.describe("Template editing workflows", () => {
  test("selects category with pointer and keyboard", async ({ page }) => {
    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);
    const secondCard = inventoryScreen.getTemplateCardScreen(1);

    await firstCard.actions.searchCategory("League");
    await firstCard.state.expectCategoryOptionVisible("League of Legends");
    await firstCard.actions.selectCategory("League of Legends");
    await firstCard.state.expectCategoryValue("League of Legends");
    await firstCard.state.expectSaveButtonVisible();

    await secondCard.actions.selectCategoryWithKeyboard("Grand", 2);
    await secondCard.state.expectCategoryValue("Grand Theft Auto V");
    await secondCard.state.expectSaveButtonVisible();
  });

  test("shows an empty state when category search has no results", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__mockApiOverrides = { categories: [] };
    });
    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);

    await firstCard.actions.searchCategory("No Such Category");

    await expect(firstCard.elements.categoryDropdown).toBeVisible();
    await expect(firstCard.elements.categoryDropdown).toContainText(
      "No results found",
    );
  });

  test("filters templates from the navbar and shows no-results state", async ({
    page,
  }) => {
    const inventoryScreen = await openInventory(page);
    const navbarScreen = new NavbarScreen(page);

    await inventoryScreen.state.expectTemplateCardCount(3);

    await navbarScreen.actions.searchTemplates("Test Stream Title 2");
    await inventoryScreen.state.expectTemplateCardCount(1);

    await navbarScreen.actions.searchTemplates("not found title");
    await inventoryScreen.state.expectTemplateCardCount(0);
    await expect(page.getByText("No results found")).toBeVisible();
  });

  test("adds, edits, removes, and deduplicates tags", async ({ page }) => {
    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);

    await firstCard.state.expectTagCount(2);

    await firstCard.actions.addTag("Tutorial");
    await firstCard.state.expectTagVisible("Tutorial");
    await firstCard.state.expectTagCount(3);
    await firstCard.state.expectSaveButtonVisible();

    await firstCard.actions.addTag("Tutorial");
    await firstCard.state.expectTagCount(3);

    await firstCard.actions.editTag("Tutorial", "Speedrun");
    await firstCard.state.expectTagHidden("Tutorial");
    await firstCard.state.expectTagVisible("Speedrun");

    await firstCard.actions.removeTag(0);
    await firstCard.state.expectTagHidden("English");
    await firstCard.state.expectTagCount(2);
  });

  test("removes the last tag with Backspace from an empty tag input", async ({
    page,
  }) => {
    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);

    await firstCard.state.expectTagVisible("English");
    await firstCard.state.expectTagVisible("Gaming");

    await firstCard.actions.removeLastTagWithBackspace();

    await firstCard.state.expectTagVisible("English");
    await firstCard.state.expectTagHidden("Gaming");
    await firstCard.state.expectTagCount(1);
    await firstCard.state.expectSaveButtonVisible();
  });

  test("does not add a tag when Enter is pressed during IME composition", async ({
    page,
  }) => {
    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);

    await firstCard.actions.pressComposingEnterInTagInput("Japanese Tag");

    await firstCard.state.expectTagHidden("Japanese Tag");
    await firstCard.state.expectTagCount(2);
    await firstCard.state.expectSaveButtonHidden();
  });

  test("hides tag input at the tag limit", async ({ page }) => {
    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);

    for (const tag of [
      "Tag3",
      "Tag4",
      "Tag5",
      "Tag6",
      "Tag7",
      "Tag8",
      "Tag9",
      "Tag10",
    ]) {
      await firstCard.actions.addTag(tag);
    }

    await firstCard.state.expectTagCount(10);
    await firstCard.state.expectTagCounterText("10/10 tags");
    await firstCard.state.expectTagInputHidden();
  });

  test("reorders tags by dragging a tag chip", async ({ page }) => {
    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);

    await firstCard.actions.addTag("Tutorial");
    await firstCard.state.expectTagTextsInOrder([
      "English",
      "Gaming",
      "Tutorial",
    ]);

    await firstCard.actions.dragTagTo("Tutorial", "English");

    await firstCard.state.expectTagTextsInOrder([
      "Tutorial",
      "English",
      "Gaming",
    ]);
    await firstCard.state.expectSaveButtonVisible();
  });

  test("reorders templates by dragging a template card handle", async ({
    page,
  }) => {
    const inventoryScreen = await openInventory(page);

    await inventoryScreen.state.expectTemplateTitlesInOrder([
      "Test Stream Title",
      "Test Stream Title 2",
      "Test Stream Title 3",
    ]);

    await inventoryScreen
      .getTemplateCardScreen(2)
      .actions.dragHandleTo(inventoryScreen.elements.templateCard(0));

    await inventoryScreen.state.expectTemplateTitlesInOrder([
      "Test Stream Title 3",
      "Test Stream Title",
      "Test Stream Title 2",
    ]);

    await page.reload();
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectTemplateTitlesInOrder([
      "Test Stream Title 3",
      "Test Stream Title",
      "Test Stream Title 2",
    ]);
  });

  test("reorders templates with the keyboard", async ({ page }) => {
    const inventoryScreen = await openInventory(page);

    await inventoryScreen.state.expectTemplateTitlesInOrder([
      "Test Stream Title",
      "Test Stream Title 2",
      "Test Stream Title 3",
    ]);

    await inventoryScreen
      .getTemplateCardScreen(0)
      .actions.reorderWithKeyboard(["ArrowDown"]);

    await inventoryScreen.state.expectTemplateTitlesInOrder([
      "Test Stream Title 2",
      "Test Stream Title",
      "Test Stream Title 3",
    ]);
  });

  test("opens X intent for unchanged templates and hides it while dirty", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const opened: unknown[][] = [];
      Object.defineProperty(window, "__openedWindows", {
        value: opened,
        configurable: true,
      });
      window.open = ((...args: unknown[]) => {
        opened.push(args);
        return null;
      }) as typeof window.open;
    });

    const inventoryScreen = await openInventory(page);
    const firstCard = inventoryScreen.getTemplateCardScreen(0);

    await firstCard.state.expectAnnounceOnXVisible();
    await firstCard.actions.announceOnX();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const opened = (window as Window & { __openedWindows?: unknown[][] })
            .__openedWindows;
          return opened?.[0] ?? null;
        }),
      )
      .toEqual([
        expect.stringContaining("https://x.com/intent/tweet?text="),
        "_blank",
        "noopener,noreferrer",
      ]);

    await firstCard.actions.updateTitle("Dirty title");
    await firstCard.state.expectAnnounceOnXHidden();
  });
});
