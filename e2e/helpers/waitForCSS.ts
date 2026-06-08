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
      const probe = document.createElement("div");
      probe.className = "h-screen w-screen flex items-center justify-center";
      probe.style.position = "fixed";
      probe.style.left = "-10000px";
      probe.style.top = "0";
      document.body.appendChild(probe);

      const probeStyle = window.getComputedStyle(probe);
      const matches =
        probeStyle.display === "flex" &&
        probeStyle.alignItems === "center" &&
        probeStyle.justifyContent === "center" &&
        Number.parseFloat(probeStyle.width) > 0 &&
        Number.parseFloat(probeStyle.height) > 0;

      document.body.removeChild(probe);
      return matches;
    },
    { timeout: 30000 },
  );
}
