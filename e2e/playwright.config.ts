import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

/**
 * OS から空きポートを 1 つもらう。listen(0) で bind → port 取得 → close の三段。
 * close〜webServer spawn の間に他プロセスが奪う TOCTOU は実用上無視できる。
 */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const { port } = addr;
        srv.close(() => resolve(port));
      } else {
        srv.close();
        reject(new Error("failed to obtain address from net.Server"));
      }
    });
  });
}

// Playwright は main process と各 worker で config を独立に再評価するため、
// getFreePort() を毎回呼ぶと worker ごとに違う port を見て server は最初の
// main process 分しか listen していない → ERR_CONNECTION_REFUSED。
// 初回に決めた port を E2E_PORT env に書き戻し、worker 側はそれを読むことで
// 一貫した port を共有する。
const PORT = process.env.E2E_PORT
  ? Number(process.env.E2E_PORT)
  : await getFreePort();
process.env.E2E_PORT = String(PORT);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
    },
  },

  // Snapshot configuration
  snapshotDir: "./__snapshots__",
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}-{platform}{ext}",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: {
      mode: "only-on-failure",
      fullPage: true,
    },
    ignoreHTTPSErrors: true,
    colorScheme: "light",
    timezoneId: "Asia/Tokyo",
    locale: "en-US",
  },

  projects: process.env.CI
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
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
    command: "bun run check:e2e:start",
    url: BASE_URL,
    // ランダム port なので毎回新規起動。開発中 watch:run 等との衝突を避ける狙い。
    reuseExistingServer: false,
    env: {
      E2E_TEST: "true",
      PORT: String(PORT),
      // server/src/index.ts の REQUIRED_ENV 検査を通すためのダミー。
      // e2e は OIDC を実通信しない (mocks/api 側で stub する) ので aud 値は無意味。
      TWITCH_CLIENT_ID: "e2e-dummy-client-id",
      // e2e では DB mock を使うため実 PostgreSQL は不要。起動時の SELECT 1 検証を skip する。
      SKIP_DB_VERIFY: "1",
    },
    timeout: 120 * 1000,
  },
});
