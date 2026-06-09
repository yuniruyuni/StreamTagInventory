import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { NavbarScreen } from "./screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

async function openInventory(page: Page, templateCount = 1) {
  await setupMocks(page, { templateCount });
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return inventoryScreen;
}

async function authenticateInExistingPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    sessionStorage.setItem(
      "twitch-id-token",
      JSON.stringify("mock-jwt-token-for-e2e"),
    );
    sessionStorage.setItem(
      "twitch-auth",
      JSON.stringify("mock-access-token-for-e2e"),
    );
  });
}

async function setOffline(
  context: BrowserContext,
  page: Page,
  offline: boolean,
) {
  await context.setOffline(offline);
  await page.evaluate(
    (isOffline) =>
      window.dispatchEvent(new Event(isOffline ? "offline" : "online")),
    offline,
  );
}

function hasClientUpdate(postData: string | null): boolean {
  if (!postData) return false;
  try {
    const parsed = JSON.parse(postData) as Record<string, unknown>;
    return Object.values(parsed).some(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        typeof (value as { clientUpdate?: unknown }).clientUpdate === "string",
    );
  } catch {
    return postData.includes("clientUpdate");
  }
}

test.describe("Template sync", () => {
  test("pushes local edits through templates.sync", async ({ page }) => {
    const inventoryScreen = await openInventory(page, 1);
    await expect(page.getByText("Synced")).toBeVisible();

    const syncRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/trpc/templates.sync") &&
        hasClientUpdate(request.postData()),
    );

    const firstCard = inventoryScreen.getTemplateCardScreen(0);
    await firstCard.actions.updateTitle("Synced Draft Title");
    await firstCard.actions.saveTemplate();

    const request = await syncRequestPromise;
    expect(hasClientUpdate(request.postData())).toBe(true);
    await expect(page.getByText("Synced")).toBeVisible();
  });

  test("shows sync status details after a successful sync", async ({
    page,
  }) => {
    await openInventory(page, 1);

    const status = page.getByText("Synced");
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("title", /Last synced:/);
  });

  test("shows sync error while keeping the inventory usable", async ({
    page,
  }) => {
    await setupMocks(page, { templateCount: 1 });
    await page.route("**/api/trpc/**templates.sync*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "sync failed" }),
      });
    });

    await page.goto("/");
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();

    await expect(page.getByText("Sync error")).toBeVisible();
    await inventoryScreen.state.expectAddTemplateButtonVisible();
  });

  test("pulls remote updates on the next background sync", async ({ page }) => {
    const controller = await setupMocks(page, { templateCount: 1 });
    await page.goto("/");
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();

    await inventoryScreen
      .getTemplateCardScreen(0)
      .state.expectTitleValue("Test Stream Title");
    await expect(page.getByText("Synced")).toBeVisible();

    controller.setRemoteTemplateTitle(
      "test-template-1",
      "Remote Updated Title",
    );
    const syncRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/api/trpc/templates.sync"),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await syncRequestPromise;

    await inventoryScreen
      .getTemplateCardScreen(0)
      .state.expectTitleValue("Remote Updated Title");
    await inventoryScreen
      .getTemplateCardScreen(0)
      .state.expectSaveButtonHidden();
    await inventoryScreen
      .getTemplateCardScreen(0)
      .state.expectRevertButtonHidden();
  });

  test("keeps offline edits locally and syncs them after reconnect", async ({
    context,
    page,
  }) => {
    const controller = await setupMocks(page, { templateCount: 1 });
    await page.goto("/");
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();
    await expect(page.getByText("Synced")).toBeVisible();

    await setOffline(context, page, true);
    controller.setSyncFailure(true);

    const firstCard = inventoryScreen.getTemplateCardScreen(0);
    await firstCard.actions.updateTitle("Offline Draft Title");
    await firstCard.actions.saveTemplate();
    await firstCard.state.expectTitleValue("Offline Draft Title");
    await expect(page.getByText("Sync error")).toBeVisible();

    const syncRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/trpc/templates.sync") &&
        hasClientUpdate(request.postData()),
    );

    controller.setSyncFailure(false);
    await setOffline(context, page, false);

    const request = await syncRequestPromise;
    expect(hasClientUpdate(request.postData())).toBe(true);
    await expect(page.getByText("Synced")).toBeVisible();
  });

  test("keeps IndexedDB template namespaces separate across users", async ({
    page,
  }) => {
    const controller = await setupMocks(page, {
      templateCount: 1,
      user: {
        id: "mock-user-a",
        twitchUserId: "mock-user-a",
        login: "mockusera",
        displayName: "Mock User A",
      },
    });
    await page.goto("/");
    let inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();

    const firstCard = inventoryScreen.getTemplateCardScreen(0);
    await firstCard.actions.updateTitle("User A Local Title");
    await firstCard.actions.saveTemplate();
    await expect(page.getByText("Synced")).toBeVisible();

    const navbarScreen = new NavbarScreen(page);
    await navbarScreen.actions.openUserMenu();
    await navbarScreen.actions.logout();
    await inventoryScreen.state.expectRedirectedToLogin();

    controller.setUser(
      {
        id: "mock-user-b",
        twitchUserId: "mock-user-b",
        login: "mockuserb",
        displayName: "Mock User B",
      },
      0,
    );
    await authenticateInExistingPage(page);
    await page.reload();

    inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();
    await inventoryScreen.state.expectTemplateCardCount(0);
    await expect(page.getByText("User A Local Title")).toBeHidden();
  });
});
