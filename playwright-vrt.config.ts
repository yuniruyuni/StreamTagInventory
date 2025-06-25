import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

// VRT専用の設定
export default defineConfig({
  ...baseConfig,

  // testIgnoreを明示的にundefinedにして、visual.spec.tsを含めるようにする
  testIgnore: undefined,

  // webServerの設定を継承（重要！）
  webServer: baseConfig.webServer,

  // スクリーンショットの保存先
  snapshotDir: "./e2e/__snapshots__/vrt",
  snapshotPathTemplate:
    "{snapshotDir}/{testFileName}/{arg}-{projectName}-{platform}{ext}",

  // VRT専用の設定をオーバーライド
  use: {
    ...baseConfig.use,
    // baseURLを明示的に設定
    baseURL: "http://localhost:3000",
    // スクリーンショットの比較設定
    ignoreHTTPSErrors: true,
    // カラースキームを固定
    colorScheme: "light",
    // タイムゾーンを固定
    timezoneId: "Asia/Tokyo",
    // ロケールを固定（英語に統一してテストの一貫性を保つ）
    locale: "en-US",
  },

  // VRTテストのみを実行
  testMatch: "**/visual.spec.ts",

  // プロジェクトをChromiumのみに限定
  projects: [
    {
      name: "chromium",
      use: {
        ...baseConfig.projects?.[0]?.use,
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
