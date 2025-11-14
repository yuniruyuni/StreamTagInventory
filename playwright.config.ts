import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  // Snapshot configuration
  snapshotDir: "./e2e/__snapshots__",
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}-{platform}{ext}",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: {
      mode: "only-on-failure",
      fullPage: true,
    },
    // VRT固有の設定を統合
    ignoreHTTPSErrors: true,
    colorScheme: "light",
    timezoneId: "Asia/Tokyo",
    locale: "en-US",
  },

  projects: process.env.CI
    ? [
        // CI環境ではChromiumのみ使用（VRTワークフローでインストールされるため）
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        // ローカル環境では全ブラウザでテスト可能
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },

        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },

        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
      ],

  webServer: {
    command: "bun run e2e:start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      E2E_TEST: "true",
    },
    timeout: 120 * 1000, // 2分のタイムアウト
  },
});
