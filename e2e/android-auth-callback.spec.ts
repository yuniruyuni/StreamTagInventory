import { expect, test } from "@playwright/test";
import {
  makeAuthCallbackHash,
  makeFakeJwt,
  startUnauthenticatedLogin,
} from "./helpers/authCallback";
import { setupMocks } from "./mocks/setupMocks";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

async function readViewportState(page: {
  evaluate: <T>(fn: () => T) => Promise<T>;
}) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    visualViewportWidth: window.visualViewport?.width ?? null,
    smBreakpoint: window.matchMedia("(min-width: 40rem)").matches,
    mdBreakpoint: window.matchMedia("(min-width: 48rem)").matches,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  }));
}

async function readScrollState(page: {
  evaluate: <T>(fn: () => T) => Promise<T>;
}) {
  return page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    canScroll: document.documentElement.scrollHeight > window.innerHeight,
  }));
}

test.describe("Android OAuth callback @android", () => {
  test("keeps mobile viewport breakpoints after Twitch callback", async ({
    page,
  }) => {
    await setupMocks(page, { authenticated: false, templateCount: 12 });

    const nonce = await startUnauthenticatedLogin(page);
    const idToken = makeFakeJwt({
      sub: "mock-twitch-user-id",
      nonce,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await page.goto(`/?oauth-callback=1#${makeAuthCallbackHash(idToken)}`);
    await expect(page).toHaveURL("/");
    expect(
      await page.evaluate(() => sessionStorage.getItem("twitch-id-token")),
    ).toBe(JSON.stringify(idToken));
    expect(
      await page.evaluate(() => sessionStorage.getItem("twitch-auth")),
    ).toBe(JSON.stringify("mock-access-token-for-e2e"));

    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();
    await expect(page.getByRole("article")).toHaveCount(12);
    await expect
      .poll(() => readScrollState(page))
      .toMatchObject({
        canScroll: true,
      });

    await expect
      .poll(() => readViewportState(page))
      .toEqual({
        clientWidth: 360,
        visualViewportWidth: 360,
        smBreakpoint: false,
        mdBreakpoint: false,
        coarsePointer: true,
      });

    const callbackViewportState = await readViewportState(page);
    await expect
      .poll(() => readScrollState(page))
      .toMatchObject({
        clientHeight: 840,
        canScroll: true,
      });
    await page.reload();
    await inventoryScreen.actions.waitForAuthentication();
    await expect(page.getByRole("article")).toHaveCount(12);
    expect(await readViewportState(page)).toEqual(callbackViewportState);
    await expect
      .poll(() => readScrollState(page))
      .toMatchObject({
        clientHeight: 840,
        canScroll: true,
      });
  });
});
