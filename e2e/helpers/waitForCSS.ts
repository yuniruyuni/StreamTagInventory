import type { Page } from "@playwright/test";

export async function waitForCSS(page: Page) {
  // CSSファイルが読み込まれていることを確認
  await page.waitForFunction(
    () => {
      const styleSheets = Array.from(document.styleSheets);
      return styleSheets.some((sheet) => {
        try {
          return (
            sheet.href?.includes("index.css") ||
            (sheet.cssRules && sheet.cssRules.length > 0)
          );
        } catch (e) {
          // CORS制限などでアクセスできない場合はスキップ
          return false;
        }
      });
    },
    { timeout: 30000 },
  );

  // DaisyUIのスタイルが適用されていることを確認
  await page.waitForFunction(
    () => {
      const testElement = document.createElement("div");
      testElement.className = "btn";
      document.body.appendChild(testElement);
      const computed = window.getComputedStyle(testElement);
      document.body.removeChild(testElement);

      // DaisyUIのボタンスタイルが適用されているかチェック
      return computed.display !== "inline" || computed.padding !== "0px";
    },
    { timeout: 30000 },
  );
}
