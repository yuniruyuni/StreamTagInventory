import { expect, type Locator, type Page, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { NavbarScreen } from "./screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

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

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      })),
    )
    .toMatchObject({
      clientWidth: 360,
      scrollWidth: 360,
      bodyScrollWidth: 360,
    });
}

async function expectLocatorWithinViewport(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = locator.page().viewportSize();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

async function expectTemplateCardsWithinViewport(page: Page) {
  const overflow = await page.getByRole("article").evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        viewportWidth: window.innerWidth,
      };
    }),
  );

  for (const rect of overflow) {
    expect(rect.left).toBeGreaterThanOrEqual(-1);
    expect(rect.right).toBeLessThanOrEqual(rect.viewportWidth + 1);
  }
}

test.describe("Android responsive layout @android", () => {
  test("does not create horizontal scroll with many cards", async ({
    page,
  }) => {
    const { inventoryScreen } = await openInventory(page, 12);

    await inventoryScreen.state.expectTemplateCardCount(12);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollHeight > window.innerHeight,
        ),
      )
      .toBe(true);
    await expectNoHorizontalScroll(page);
    await expectTemplateCardsWithinViewport(page);
  });

  test("keeps cards and the add-template target inside the mobile viewport", async ({
    page,
  }) => {
    const { inventoryScreen } = await openInventory(page, 0);

    await inventoryScreen.state.expectTemplateCardCount(0);
    await inventoryScreen.state.expectAddTemplateCardWithinViewport();
    await expectNoHorizontalScroll(page);

    await inventoryScreen.actions.addTemplate();

    await inventoryScreen.state.expectTemplateCardCount(1);
    await expectLocatorWithinViewport(page.getByRole("article").first());
    await inventoryScreen.state.expectAddTemplateCardWithinViewport();
    await expectNoHorizontalScroll(page);
  });

  test("keeps layout usable after portrait and landscape viewport changes", async ({
    page,
  }) => {
    const { inventoryScreen, navbarScreen } = await openInventory(page, 6);

    await inventoryScreen.state.expectTemplateCardCount(6);
    await navbarScreen.state.expectDesktopSearchHidden();
    await expectNoHorizontalScroll(page);

    await page.setViewportSize({ width: 840, height: 360 });

    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectTemplateCardCount(6);
    await navbarScreen.state.expectDesktopSearchVisible();
    await navbarScreen.actions.openUserMenu();
    await navbarScreen.state.expectUserMenuDropdownVisible();
    await expectTemplateCardsWithinViewport(page);
  });

  test("hides desktop search and keeps the user menu operable on mobile", async ({
    page,
  }) => {
    const { navbarScreen } = await openInventory(page, 1);

    await navbarScreen.state.expectDesktopSearchHidden();
    await navbarScreen.actions.openUserMenu();

    await navbarScreen.state.expectUserMenuDropdownVisible();
    await expect(navbarScreen.elements.importTemplatesButton).toBeVisible();
    await expect(navbarScreen.elements.exportTemplatesButton).toBeVisible();
    await expect(navbarScreen.elements.postTemplateButton).toBeVisible();
    await expect(navbarScreen.elements.logoutButton).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
