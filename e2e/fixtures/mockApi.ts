import type { Page } from '@playwright/test';
import { mockUser, mockChannel, mockCategories, mockTags } from './mockData';

export async function setupMockApi(page: Page) {
  // First inject mock data as globals
  await page.addInitScript({
    content: `
      window.mockUser = ${JSON.stringify(mockUser)};
      window.mockChannel = ${JSON.stringify(mockChannel)};
      window.mockCategories = ${JSON.stringify(mockCategories)};
      window.mockTags = ${JSON.stringify(mockTags)};
    `
  });

  // Then add init script that runs before page load
  await page.addInitScript(() => {
    // Enable E2E test mode
    window.E2E_TEST_MODE = true;
    window.E2E_TEST_TOKEN = "test-token";

    // Set up mock templates in localStorage
    const mockTemplates = [{
      id: "test-template-1",
      name: "Test Template 1",
      category: {
        id: "509658",
        name: "Just Chatting",
        box_art_url: "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg"
      },
      title: "Test Stream Title",
      tags: ["English", "Gaming"],
      language: "en"
    }];
    
    localStorage.setItem('templates', JSON.stringify(mockTemplates));

    // Mock API function
    window.E2E_MOCK_API = (url: string, init: RequestInit) => {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // Mock user endpoint
      if (path.includes('/helix/users')) {
        return [window.mockUser];
      }

      // Mock channels endpoint
      if (path.includes('/helix/channels')) {
        if (init.method === 'PATCH') {
          // Update channel - return no content
          return undefined;
        }
        return [window.mockChannel];
      }

      // Mock categories search
      if (path.includes('/helix/search/categories')) {
        return window.mockCategories;
      }

      // Mock tags endpoint
      if (path.includes('/helix/tags/streams')) {
        return window.mockTags;
      }

      // Mock stream markers
      if (path.includes('/helix/streams/markers')) {
        return { created_at: new Date().toISOString() };
      }

      // Default empty response
      return [];
    };
  });
}

// Import mock data into the page context
export async function injectMockData(page: Page) {
  await page.addScriptTag({
    content: `
      const mockUser = ${JSON.stringify(mockUser)};
      const mockChannel = ${JSON.stringify(mockChannel)};
      const mockCategories = ${JSON.stringify(mockCategories)};
      const mockTags = ${JSON.stringify(mockTags)};
    `
  });
}