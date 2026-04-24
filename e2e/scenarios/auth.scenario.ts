import { expect, test } from "@playwright/test";
import { setupMocks } from "../mocks/setupMocks";
import { InventoryScreen } from "../screens/inventory/InventoryScreen";
import { LoginScreen } from "../screens/login/LoginScreen";

test.describe("Auth regression", () => {
  // PR #103 / #104: ログイン済のユーザーが reload したとき、localStorage に
  // oauth_nonce が新規発行される不具合が production で表面化した。lazy init の
  // ensureNonce が無条件に走っていたのが原因。unit test ではカバーできるが、
  // 実ブラウザの挙動 (COOP / sessionStorage / storage event の組合せ) を丸ごと
  // 検証する砦として e2e にも regression guard を置く。
  test("reload while authenticated does not create oauth_nonce in localStorage", async ({
    page,
  }) => {
    await setupMocks(page);
    await page.goto("/");

    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();

    // 初期 render: lazy init が idToken 有を検出して ensureNonce を skip しているはず
    expect(
      await page.evaluate(() => localStorage.getItem("oauth_nonce")),
    ).toBeNull();

    await page.reload();
    await inventoryScreen.actions.waitForAuthentication();
    await inventoryScreen.state.expectInventoryPageVisible();

    // reload 後も同様。ここが null でないと PR #104 以前の挙動に逆戻りしている
    expect(
      await page.evaluate(() => localStorage.getItem("oauth_nonce")),
    ).toBeNull();
  });

  // Phase B: id_token が server 側で reject (期限切れ / signature 不整合) された
  // 時に session を掃除して Entrance に戻す経路。PR #91 で誤発動の regression も
  // あったため実ブラウザでの挙動を押さえる価値が高い。
  test("server 401 on auth.me triggers Phase B cleanup and returns to Entrance", async ({
    page,
  }) => {
    await setupMocks(page);

    // setupMocks の auth.me route を上書きして 401 を返す。Playwright の
    // page.route は後勝ち (最後に登録した handler が優先) で、pattern が同じなら
    // 既存 handler を抑える。
    await page.route("**/api/trpc/auth.me*", async (route) => {
      const body = [
        {
          error: {
            json: {
              message: "UNAUTHORIZED",
              code: -32001,
              data: {
                code: "UNAUTHORIZED",
                httpStatus: 401,
                path: "auth.me",
              },
            },
          },
        },
      ];
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/");

    // Phase B が発火して Entrance まで降りてくる
    const loginScreen = new LoginScreen(page);
    await loginScreen.state.expectLoginPageVisible();

    // session 側の token が両方消えている (Phase B の removeIdToken / removeAccessToken)
    expect(
      await page.evaluate(() => sessionStorage.getItem("twitch-id-token")),
    ).toBeNull();
    expect(
      await page.evaluate(() => sessionStorage.getItem("twitch-auth")),
    ).toBeNull();

    // rotateNonce が走って新しい nonce が localStorage に居る (= Entrance の
    // authorize URL 生成に備えた状態)
    expect(
      await page.evaluate(() => localStorage.getItem("oauth_nonce")),
    ).not.toBeNull();
  });
});
