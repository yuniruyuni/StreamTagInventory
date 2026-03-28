import type { Page } from "@playwright/test";

export async function setupMocksUnauthenticated(page: Page) {
  // Set up mocks WITHOUT authentication token
  await page.addInitScript(() => {
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
