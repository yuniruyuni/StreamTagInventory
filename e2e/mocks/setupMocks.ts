import type { Page } from "@playwright/test";

/**
 * 認証済 user として e2e を走らせるためのセットアップ (ADR 0007 用に再設計)。
 *
 * ADR 0007 で TwitchAuthProvider が以下の挙動になったので、それぞれ stub する:
 *
 * 1. **sessionStorage を直接読む** (`twitch-id-token` / `twitch-auth`)。
 *    addInitScript で page load 前に書き込む。`useSession` が `JSON.stringify` を
 *    通すため、文字列はクォート込みの JSON で保存する必要がある。
 *
 * 2. **`trpc.auth.me` を毎リクエスト叩く**。server 側は本物の Twitch JWKS で
 *    JWT を検証するので e2e の mock token は通らない。`page.route` で
 *    `/api/trpc/auth.me*` を intercept して mock user を返す。
 *
 * 認証不要のテスト (basic.scenario.ts 等) では呼ばないこと。
 */
export async function setupMocks(page: Page) {
  // tRPC v11 batched response (HTTP) 形式: 配列の各要素が `result.data` を持つ。
  // batch=1 の単一クエリでも配列で返す必要がある。
  await page.route("**/api/trpc/auth.me*", async (route) => {
    const response = [
      {
        result: {
          data: {
            user: {
              id: "mock-twitch-user-id",
              twitchUserId: "mock-twitch-user-id",
              login: "mockuser",
              displayName: "Mock User",
            },
          },
        },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.addInitScript(() => {
    // ADR 0007: id_token / access_token を sessionStorage に直接置いて
    // 「認証済」状態を作る。`useSession` の JSON.stringify 形式に合わせる。
    sessionStorage.setItem(
      "twitch-id-token",
      JSON.stringify("mock-jwt-token-for-e2e"),
    );
    sessionStorage.setItem(
      "twitch-auth",
      JSON.stringify("mock-access-token-for-e2e"),
    );

    // Force English locale for consistent testing
    localStorage.setItem("language", "en");

    const mockTemplates = [
      {
        id: "test-template-1",
        name: "Test Template 1",
        category: {
          id: "509658",
          name: "Just Chatting",
          box_art_url:
            "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg",
        },
        title: "Test Stream Title",
        tags: ["English", "Gaming"],
        language: "en",
      },
    ];

    localStorage.setItem("templates", JSON.stringify(mockTemplates));
  });
}
