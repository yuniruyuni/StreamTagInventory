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

  await page.waitForFunction(
    () => {
      const probe = document.createElement("div");
      probe.className =
        "fixed h-screen w-screen flex items-center justify-center text-4xl font-bold";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);

      const style = getComputedStyle(probe);
      const isReady =
        style.display === "flex" &&
        style.alignItems === "center" &&
        style.justifyContent === "center" &&
        Math.abs(parseFloat(style.height) - window.innerHeight) <= 1 &&
        Math.abs(parseFloat(style.width) - window.innerWidth) <= 1 &&
        parseFloat(style.fontSize) >= 32 &&
        Number(style.fontWeight) >= 700;

      probe.remove();
      return isReady;
    },
    { timeout: 30000 },
  );
}

export async function waitForEntranceStyles(page: Page) {
  await waitForCSS(page);

  await page.waitForFunction(
    () => {
      const screen = document.querySelector('[data-testid="entrance-screen"]');
      const heading = screen?.querySelector("h1");

      if (!screen || !heading) {
        return false;
      }

      const screenStyle = getComputedStyle(screen);
      const headingStyle = getComputedStyle(heading);

      return (
        screenStyle.display === "flex" &&
        screenStyle.flexDirection === "column" &&
        screenStyle.alignItems === "center" &&
        screenStyle.justifyContent === "center" &&
        Math.abs(parseFloat(screenStyle.height) - window.innerHeight) <= 1 &&
        Math.abs(parseFloat(screenStyle.width) - window.innerWidth) <= 1 &&
        parseFloat(headingStyle.fontSize) >= 32 &&
        Number(headingStyle.fontWeight) >= 700
      );
    },
    { timeout: 30000 },
  );
}
