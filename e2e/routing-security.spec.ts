import { expect, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";

test.describe("Routing and security smoke", () => {
  test("serves the SPA for unknown paths", async ({ page }) => {
    await page.goto("/some/deep/path");

    await expect(page).toHaveTitle("Stream Tag Inventory");
    await expect(
      page.getByRole("link", { name: /Login with Twitch|Twitchでログイン/ }),
    ).toBeVisible();
  });

  test("serves the health endpoint", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  test("sets no-store cache headers for API responses", async ({ request }) => {
    const response = await request.get("/api/trpc/auth.me");

    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe(
      "no-store, no-cache, must-revalidate, private, max-age=0",
    );
    // hono 4.13 から compress() が Vary に Accept-Encoding を追記する。
    // 圧縮の有無が Accept-Encoding に依存する以上そちらが正しいので、
    // 「Authorization が載っていること」だけを見る。ここが落ちると
    // キャッシュが利用者をまたいで応答を配りうるので緩めないこと。
    const vary = (response.headers().vary ?? "")
      .split(",")
      .map((value) => value.trim());
    expect(vary).toContain("Authorization");
  });

  test("exposes a safe author link", async ({ page }) => {
    await page.goto("/");

    const authorLink = page.getByRole("link", {
      name: /created by yuniruyuni/i,
    });
    await expect(authorLink).toBeVisible();
    await expect(authorLink).toHaveAttribute("href", "https://yuniruyuni.net/");
    await expect(authorLink).toHaveAttribute("target", "_blank");
    await expect(authorLink).toHaveAttribute("rel", /noopener/);
    await expect(authorLink).toHaveAttribute("rel", /noreferrer/);
  });

  test("builds a Twitch authorize URL with OIDC parameters", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/");

    const loginLink = page.getByRole("link", {
      name: /Login with Twitch|Twitchでログイン/,
    });
    const href = await loginLink.getAttribute("href");
    expect(href).toBeTruthy();

    const url = new URL(href ?? "");
    const scope = url.searchParams.get("scope")?.split(" ") ?? [];
    const claims = JSON.parse(url.searchParams.get("claims") ?? "{}") as {
      id_token?: { preferred_username?: null };
    };

    expect(url.origin).toBe("https://id.twitch.tv");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("token id_token");
    expect(url.searchParams.get("client_id")).toBe("e2e-dummy-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(`${baseURL}/`);
    expect(scope).toContain("openid");
    expect(scope).toContain("user:edit:broadcast");
    expect(scope).toContain("channel:manage:broadcast");
    expect(scope).toContain("channel_editor");
    expect(url.searchParams.get("nonce")).toEqual(expect.any(String));
    expect(claims).toEqual({
      id_token: { preferred_username: null },
    });
  });

  test("does not log CSP violations on the login screen", async ({ page }) => {
    const cspErrors: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /content security policy|violat/i.test(message.text())
      ) {
        cspErrors.push(message.text());
      }
    });

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Login with Twitch|Twitchでログイン/ }),
    ).toBeVisible();

    expect(cspErrors).toEqual([]);
  });

  test("shows the authenticated UI within the basic load budget", async ({
    page,
  }) => {
    await setupMocks(page);

    const startedAt = performance.now();
    await page.goto("/");
    await expect(page.getByRole("button", { name: "user menu" })).toBeVisible();
    const elapsedMs = performance.now() - startedAt;

    expect(elapsedMs).toBeLessThan(5_000);
  });
});
