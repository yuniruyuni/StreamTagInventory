import { expect, type Locator, type Page, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { NavbarScreen } from "./screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

async function openInventory(page: Page) {
  await setupMocks(page);
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return {
    inventoryScreen,
    navbarScreen: new NavbarScreen(page),
  };
}

async function expectFocused(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((element) => element === document.activeElement),
    )
    .toBe(true);
}

async function tabUntilFocused(page: Page, locator: Locator, limit = 12) {
  for (let i = 0; i < limit; i++) {
    if (
      await locator.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expectFocused(locator);
}

test.describe("i18n and accessibility", () => {
  test("switches language and keeps it after reload", async ({ page }) => {
    const { navbarScreen } = await openInventory(page);

    await navbarScreen.elements.languageSelect.selectOption("ja");
    await expect(page.getByRole("button", { name: "user menu" })).toBeVisible();
    await navbarScreen.actions.openUserMenu();
    await expect(
      navbarScreen.elements.userMenuDropdown.getByRole("button", {
        name: "投稿テンプレート",
      }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("language")))
      .toBe("ja");

    await page.reload();
    await new InventoryScreen(page).actions.waitForAuthentication();
    await expect(navbarScreen.elements.languageSelect).toHaveValue("ja");
    await navbarScreen.actions.openUserMenu();
    await expect(
      navbarScreen.elements.userMenuDropdown.getByRole("button", {
        name: "ログアウト",
      }),
    ).toBeVisible();
  });

  test("falls back when localStorage has an unsupported language", async ({
    page,
  }) => {
    await setupMocks(page, { language: "unknown" });

    await page.goto("/");
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();

    await expect(page.getByRole("button", { name: "user menu" })).toBeVisible();
    await expect(new NavbarScreen(page).elements.languageSelect).toHaveValue(
      "ja",
    );
    await expect(page.getByText("現在の配信情報")).toBeVisible();
  });

  test("uses the selected language in the apply payload", async ({ page }) => {
    await page.addInitScript(() => {
      window.__mockApiRequests = [];
    });
    const { inventoryScreen, navbarScreen } = await openInventory(page);

    await navbarScreen.actions.selectLanguage("ja");
    await expect(navbarScreen.elements.languageSelect).toHaveValue("ja");
    await inventoryScreen.getTemplateCardScreen(0).actions.applyTemplate();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const request = window.__mockApiRequests?.find(
            (entry) =>
              entry.method === "PATCH" &&
              entry.path.includes("/helix/channels"),
          );
          return request?.body;
        }),
      )
      .toMatchObject({ broadcaster_language: "ja" });
  });

  test("uses the selected language when searching categories", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__mockApiRequests = [];
    });
    const { inventoryScreen, navbarScreen } = await openInventory(page);

    await navbarScreen.actions.selectLanguage("ja");
    await expect(navbarScreen.elements.languageSelect).toHaveValue("ja");
    await page.evaluate(() => {
      window.__mockApiRequests = [];
    });
    await inventoryScreen
      .getTemplateCardScreen(0)
      .actions.searchCategory("League");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const request = window.__mockApiRequests?.find(
            (entry) =>
              entry.method === "GET" &&
              entry.path.includes("/helix/search/categories"),
          );
          return request?.language;
        }),
      )
      .toBe("ja");
  });

  test("reaches the Twitch login link with the keyboard", async ({ page }) => {
    await setupMocks(page, { authenticated: false });
    await page.goto("/");

    const loginLink = page.getByRole("link", { name: "Login with Twitch" });
    await tabUntilFocused(page, loginLink);
  });

  test("opens and closes the user menu from the keyboard", async ({ page }) => {
    const { navbarScreen } = await openInventory(page);
    const avatarButton = navbarScreen.elements.avatarButton;

    await tabUntilFocused(page, avatarButton);
    await expect(navbarScreen.elements.userMenuDropdown).toBeVisible();

    await page.keyboard.press("Tab");
    await expectFocused(navbarScreen.elements.importTemplatesButton);

    await page.keyboard.press("Escape");
    await expect(navbarScreen.elements.userMenuDropdown).toBeHidden();
    await expectFocused(avatarButton);
  });

  test("keeps focus inside the post template dialog and closes with Escape", async ({
    page,
  }) => {
    const { navbarScreen } = await openInventory(page);
    await navbarScreen.actions.openPostTemplateEditor();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      await expect
        .poll(() =>
          dialog.evaluate(
            (element) =>
              document.activeElement !== null &&
              element.contains(document.activeElement),
          ),
        )
        .toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
