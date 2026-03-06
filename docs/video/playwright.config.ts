import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "capture-screenshots.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",

  use: {
    baseURL: "http://localhost:3100",
    locale: "ja",
    colorScheme: "light",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "cd ../../.. && bun run e2e:build && bun run docs/intro-video/remotion/serve-for-capture.ts",
    port: 3100,
    reuseExistingServer: true,
    timeout: 120 * 1000,
    env: {
      E2E_TEST: "true",
    },
  },
});
