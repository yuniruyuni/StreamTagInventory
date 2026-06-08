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
      const sizedIcon = document.querySelector(".w-5");
      if (sizedIcon) {
        const iconStyle = window.getComputedStyle(sizedIcon);
        return (
          Number.parseFloat(iconStyle.width) <= 32 &&
          Number.parseFloat(iconStyle.height) <= 32
        );
      }

      const main = document.querySelector("main");
      if (!main) return false;
      const mainStyle = window.getComputedStyle(main);

      return (
        mainStyle.display === "flex" &&
        mainStyle.alignItems === "center" &&
        mainStyle.justifyContent === "center"
      );
    },
    { timeout: 30000 },
  );
}
