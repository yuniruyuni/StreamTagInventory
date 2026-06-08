import type { Page } from "@playwright/test";

export async function waitForCSS(page: Page) {
  // The visual tests must fail before taking screenshots if Tailwind is absent.
  await page.waitForFunction(
    () => {
      return Array.from(document.styleSheets).some((sheet) => {
        try {
          return (
            sheet.href?.endsWith("/index.css") &&
            sheet.cssRules &&
            sheet.cssRules.length > 0
          );
        } catch (_e) {
          return false;
        }
      });
    },
    { timeout: 30000 },
  );

  await page.waitForFunction(
    () => {
      return Array.from(document.styleSheets).some((sheet) => {
        try {
          if (!sheet.href?.endsWith("/index.css") || !sheet.cssRules) {
            return false;
          }

          return Array.from(sheet.cssRules).some((rule) => {
            return (
              rule.cssText.includes(".flex") ||
              rule.cssText.includes(".h-screen") ||
              rule.cssText.includes(".w-screen")
            );
          });
        } catch (_e) {
          return false;
        }
      });
    },
    { timeout: 30000 },
  );
}
