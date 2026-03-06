import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import { test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.resolve(__dirname, "public/screenshots");
const avatarPath = path.resolve(__dirname, "../../../yuniruyuni.png");

// --- Highlight computation utility ---

type Rect = { x: number; y: number; width: number; height: number };
type Highlight = { x: number; y: number; w: number; h: number };

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Compute a percentage-based highlight rect from the union bounding box of
 * target Locators, relative to a container (Locator or viewport).
 * `padding` is in percent of the container.
 */
async function computeHighlight(
  page: Page,
  container: Locator | null, // null = viewport
  targets: Locator[],
  padding = 2,
): Promise<Highlight> {
  let containerBox: Rect;
  if (container) {
    const box = await container.boundingBox();
    if (!box) throw new Error("Container element not found");
    containerBox = box;
  } else {
    const vs = page.viewportSize();
    if (!vs) throw new Error("Viewport size not available");
    containerBox = { x: 0, y: 0, width: vs.width, height: vs.height };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const loc of targets) {
    const count = await loc.count();
    for (let i = 0; i < count; i++) {
      const box = await loc.nth(i).boundingBox();
      if (box) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
      }
    }
  }

  if (!Number.isFinite(minX)) throw new Error("No target elements found");

  const pctX = ((minX - containerBox.x) / containerBox.width) * 100;
  const pctY = ((minY - containerBox.y) / containerBox.height) * 100;
  const pctW = ((maxX - minX) / containerBox.width) * 100;
  const pctH = ((maxY - minY) / containerBox.height) * 100;

  return {
    x: round1(Math.max(0, pctX - padding)),
    y: round1(Math.max(0, pctY - padding)),
    w: round1(Math.min(100 - Math.max(0, pctX - padding), pctW + padding * 2)),
    h: round1(Math.min(100 - Math.max(0, pctY - padding), pctH + padding * 2)),
  };
}

// Collected highlights, written to JSON at the end
const highlights: Record<string, Highlight> = {};

// --- Visible cursor for video recording ---

/** Inject a visible cursor overlay. Call AFTER page content is loaded. */
async function injectVisibleCursor(page: Page) {
  await page.evaluate(() => {
    const cursor = document.createElement("div");
    cursor.id = "__fake-cursor";
    Object.assign(cursor.style, {
      position: "fixed",
      top: "0px",
      left: "0px",
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      background: "rgba(255, 80, 80, 0.6)",
      border: "3px solid rgba(255, 255, 255, 0.95)",
      boxShadow:
        "0 0 20px rgba(255, 80, 80, 0.5), 0 0 40px rgba(255, 80, 80, 0.2)",
      pointerEvents: "none",
      zIndex: "999999",
      transform: "translate(-50%, -50%)",
      transition:
        "width 0.15s, height 0.15s, background 0.15s, box-shadow 0.15s",
      display: "none",
    });
    document.body.appendChild(cursor);

    document.addEventListener("mousemove", (e) => {
      cursor.style.display = "block";
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });
    document.addEventListener("mousedown", () => {
      cursor.style.width = "30px";
      cursor.style.height = "30px";
      cursor.style.background = "rgba(255, 200, 50, 0.9)";
      cursor.style.boxShadow =
        "0 0 24px rgba(255, 200, 50, 0.7), 0 0 48px rgba(255, 200, 50, 0.3)";
    });
    document.addEventListener("mouseup", () => {
      cursor.style.width = "40px";
      cursor.style.height = "40px";
      cursor.style.background = "rgba(255, 80, 80, 0.6)";
      cursor.style.boxShadow =
        "0 0 20px rgba(255, 80, 80, 0.5), 0 0 40px rgba(255, 80, 80, 0.2)";
    });
  });
}

// --- Page setup helpers ---

async function setupJapaneseMocks(page: Page) {
  await page.route("**/example.com/profile.png", (route) =>
    route.fulfill({ path: avatarPath }),
  );

  return page.addInitScript(() => {
    window.__mockAuthToken = "test-token";
    localStorage.setItem("language", "ja");

    const mockTemplates = [
      {
        id: "template-minecraft",
        title: "Minecraft Building Stream",
        category: {
          id: "27471",
          name: "Minecraft",
          box_art_url:
            "https://static-cdn.jtvnw.net/ttv-boxart/27471-{width}x{height}.jpg",
        },
        tags: ["building", "creative", "chill"],
      },
      {
        id: "template-apex",
        title: "Apex Legends Ranked",
        category: {
          id: "511224",
          name: "Apex Legends",
          box_art_url:
            "https://static-cdn.jtvnw.net/ttv-boxart/511224-{width}x{height}.jpg",
        },
        tags: ["ranked", "FPS", "competitive"],
      },
      {
        id: "template-valorant",
        title: "VALORANT Competitive",
        category: {
          id: "516575",
          name: "VALORANT",
          box_art_url:
            "https://static-cdn.jtvnw.net/ttv-boxart/516575-{width}x{height}.jpg",
        },
        tags: ["competitive", "FPS", "tactical"],
      },
    ];

    localStorage.setItem("templates", JSON.stringify(mockTemplates));
  });
}

async function waitForApp(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => {
      const styleSheets = Array.from(document.styleSheets);
      return styleSheets.some((sheet) => {
        try {
          return (
            sheet.href?.includes("index.css") ||
            (sheet.cssRules && sheet.cssRules.length > 0)
          );
        } catch {
          return false;
        }
      });
    },
    { timeout: 30000 },
  );
  await page.waitForTimeout(1000);
}

// --- Screenshot tests ---

test.describe("Capture screenshots for intro video", () => {
  test("login page", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("language", "ja");
    });
    await page.goto("/");
    await waitForApp(page);

    await page.screenshot({
      path: path.join(screenshotDir, "login.png"),
      fullPage: false,
    });

    // Compute highlight for the login button
    const loginBtn = page.locator('a:has-text("Twitchでログイン")');
    highlights["login:twitch-button"] = await computeHighlight(
      page,
      null,
      [loginBtn],
      1.5,
    );
  });

  test("main inventory page (3 templates, apply state)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await setupJapaneseMocks(page);
    await page.goto("/");
    await waitForApp(page);

    await page.locator(".card").first().waitFor({ state: "visible" });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(screenshotDir, "main.png"),
      fullPage: false,
    });

    // Compute highlights for main.png (container = viewport)
    const infoPanel = page.locator("div.bg-surface-alt.rounded-lg");
    const importBtn = page.locator(
      'button:has-text("テンプレートとして取り込む")',
    );
    const cards = page.locator(".card");

    highlights["main:info-panel"] = await computeHighlight(
      page,
      null,
      [infoPanel],
      2,
    );
    highlights["main:templates"] = await computeHighlight(
      page,
      null,
      [cards],
      2,
    );
    highlights["main:import-button"] = await computeHighlight(
      page,
      null,
      [importBtn],
      1,
    );
  });

  test("template card close-up", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await setupJapaneseMocks(page);
    await page.goto("/");
    await waitForApp(page);

    await page.locator(".card").first().waitFor({ state: "visible" });
    await page.waitForTimeout(300);

    const card = page.locator(".card").first();
    await card.screenshot({
      path: path.join(screenshotDir, "card.png"),
    });

    // Compute highlights for card.png (container = card element)
    const titleLabel = card.locator('label:has-text("タイトル")');
    const titleInput = card.locator('input[name="title"]');
    const tagsLabel = card.locator('label:has-text("タグ")');
    const tagsFieldset = card.locator("fieldset");
    const cloneBtn = card.locator('button[aria-label="clone template"]');
    const deleteBtn = card.locator('button[aria-label="remove template"]');
    const applyBtn = card.locator('button[aria-label="apply template"]');

    highlights["card:title"] = await computeHighlight(
      page,
      card,
      [titleLabel, titleInput],
      2,
    );
    highlights["card:tags"] = await computeHighlight(
      page,
      card,
      [tagsLabel, tagsFieldset],
      2,
    );
    highlights["card:actions"] = await computeHighlight(
      page,
      card,
      [cloneBtn, deleteBtn, applyBtn],
      2,
    );
    highlights["card:apply"] = await computeHighlight(
      page,
      card,
      [applyBtn],
      1.5,
    );
  });

  test("category dropdown open", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await setupJapaneseMocks(page);
    await page.goto("/");
    await waitForApp(page);

    await page.locator(".card").first().waitFor({ state: "visible" });

    const card = page.locator(".card").first();
    const categoryInput = card.locator('input[id="category"]');
    await categoryInput.click();
    await page.waitForTimeout(500);

    await card.screenshot({
      path: path.join(screenshotDir, "category.png"),
    });

    // Compute highlight for category.png (container = card element)
    const categoryLabel = card.locator('label:has-text("カテゴリ")');
    const comboboxDropdown = card.locator('[data-testid="combobox-dropdown"]');

    highlights["category:dropdown"] = await computeHighlight(
      page,
      card,
      [categoryLabel, categoryInput, comboboxDropdown],
      2,
    );
  });

  test("empty state (add-new button only)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.route("**/example.com/profile.png", (route) =>
      route.fulfill({ path: avatarPath }),
    );
    await page.addInitScript(() => {
      window.__mockAuthToken = "test-token";
      localStorage.setItem("language", "ja");
      localStorage.setItem("templates", JSON.stringify([]));
    });
    await page.goto("/");
    await waitForApp(page);
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, "empty.png"),
      fullPage: false,
    });

    // Compute highlight for empty.png (container = viewport)
    const addCard = page.locator("div.outline-dashed");

    highlights["empty:add-button"] = await computeHighlight(
      page,
      null,
      [addCard],
      2,
    );
  });

  test("template card with changes (modified state)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await setupJapaneseMocks(page);
    await page.goto("/");
    await waitForApp(page);

    await page.locator(".card").first().waitFor({ state: "visible" });

    const card = page.locator(".card").first();
    const titleInput = card.locator('input[name="title"]');
    await titleInput.fill("Modified Title");
    await page.waitForTimeout(300);

    await card.screenshot({
      path: path.join(screenshotDir, "modified.png"),
    });
  });

  test("drag-and-drop reorder video", async ({ browser }) => {
    const videoDir = path.resolve(__dirname, "public/videos");
    fs.mkdirSync(videoDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      locale: "ja",
      colorScheme: "light",
      recordVideo: {
        dir: videoDir,
        size: { width: 1600, height: 900 },
      },
    });

    const page = await context.newPage();

    // Setup with 3 templates for clearer drag demo
    await page.route("**/example.com/profile.png", (route) =>
      route.fulfill({ path: avatarPath }),
    );
    await page.addInitScript(() => {
      window.__mockAuthToken = "test-token";
      localStorage.setItem("language", "ja");

      const mockTemplates = [
        {
          id: "template-minecraft",
          title: "Minecraft Building Stream",
          category: {
            id: "27471",
            name: "Minecraft",
            box_art_url:
              "https://static-cdn.jtvnw.net/ttv-boxart/27471-{width}x{height}.jpg",
          },
          tags: ["building", "creative"],
        },
        {
          id: "template-apex",
          title: "Apex Legends Ranked",
          category: {
            id: "511224",
            name: "Apex Legends",
            box_art_url:
              "https://static-cdn.jtvnw.net/ttv-boxart/511224-{width}x{height}.jpg",
          },
          tags: ["ranked", "FPS"],
        },
        {
          id: "template-valorant",
          title: "VALORANT Competitive",
          category: {
            id: "516575",
            name: "VALORANT",
            box_art_url:
              "https://static-cdn.jtvnw.net/ttv-boxart/516575-{width}x{height}.jpg",
          },
          tags: ["competitive", "FPS"],
        },
      ];
      localStorage.setItem("templates", JSON.stringify(mockTemplates));
    });

    await page.goto("/");
    await waitForApp(page);
    await page.locator(".card").first().waitFor({ state: "visible" });
    await injectVisibleCursor(page);
    await page.waitForTimeout(200);

    // Drag first card to second position (swap with neighbor)
    const firstCard = page.locator(".card").first();
    const secondCard = page.locator(".card").nth(1);
    const dragHandle = firstCard.locator(
      'button:has(svg[viewBox="0 0 20 20"])',
    );
    const targetHandle = secondCard.locator(
      'button:has(svg[viewBox="0 0 20 20"])',
    );

    const handleBox = await dragHandle.boundingBox();
    const targetBox = await targetHandle.boundingBox();

    if (handleBox && targetBox) {
      const handleX = handleBox.x + handleBox.width / 2;
      const handleY = handleBox.y + handleBox.height / 2;
      const endX = targetBox.x + targetBox.width / 2;
      const endY = targetBox.y + targetBox.height / 2;

      // Start cursor at screen center, then move to drag handle
      const centerX = 800;
      const centerY = 450;
      await page.mouse.move(centerX, centerY);
      await page.waitForTimeout(100);
      const approachSteps = 15;
      for (let i = 1; i <= approachSteps; i++) {
        const t = i / approachSteps;
        await page.mouse.move(
          centerX + (handleX - centerX) * t,
          centerY + (handleY - centerY) * t,
        );
        await page.waitForTimeout(20);
      }
      await page.waitForTimeout(150);

      // Grab and drag to target handle
      await page.mouse.down();
      await page.waitForTimeout(150);
      const dragSteps = 20;
      for (let i = 1; i <= dragSteps; i++) {
        const t = i / dragSteps;
        await page.mouse.move(
          handleX + (endX - handleX) * t,
          handleY + (endY - handleY) * t,
        );
        await page.waitForTimeout(15);
      }

      await page.waitForTimeout(150);
      await page.mouse.up();
      await page.waitForTimeout(200);
    }

    const dndOutPath = path.join(videoDir, "dnd-reorder.webm");
    const dndVideo = page.video();
    if (!dndVideo) throw new Error("Video recording not available");
    await context.close();
    await dndVideo.saveAs(dndOutPath);
    await dndVideo.delete();
  });

  test("clone template video", async ({ browser }) => {
    const videoDir = path.resolve(__dirname, "public/videos");
    fs.mkdirSync(videoDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      locale: "ja",
      colorScheme: "light",
      recordVideo: {
        dir: videoDir,
        size: { width: 1600, height: 900 },
      },
    });

    const page = await context.newPage();

    await page.route("**/example.com/profile.png", (route) =>
      route.fulfill({ path: avatarPath }),
    );
    await page.addInitScript(() => {
      window.__mockAuthToken = "test-token";
      localStorage.setItem("language", "ja");

      const mockTemplates = [
        {
          id: "template-minecraft",
          title: "Minecraft Building Stream",
          category: {
            id: "27471",
            name: "Minecraft",
            box_art_url:
              "https://static-cdn.jtvnw.net/ttv-boxart/27471-{width}x{height}.jpg",
          },
          tags: ["building", "creative"],
        },
        {
          id: "template-apex",
          title: "Apex Legends Ranked",
          category: {
            id: "511224",
            name: "Apex Legends",
            box_art_url:
              "https://static-cdn.jtvnw.net/ttv-boxart/511224-{width}x{height}.jpg",
          },
          tags: ["ranked", "FPS"],
        },
      ];
      localStorage.setItem("templates", JSON.stringify(mockTemplates));
    });

    await page.goto("/");
    await waitForApp(page);
    await page.locator(".card").first().waitFor({ state: "visible" });
    await injectVisibleCursor(page);
    await page.waitForTimeout(200);

    // Start cursor at screen center, then move to clone button
    const firstCard = page.locator(".card").first();
    const cloneBtn = firstCard.locator('button[aria-label="clone template"]');
    const cloneBtnBox = await cloneBtn.boundingBox();
    if (cloneBtnBox) {
      const centerX = 800;
      const centerY = 450;
      const targetX = cloneBtnBox.x + cloneBtnBox.width / 2;
      const targetY = cloneBtnBox.y + cloneBtnBox.height / 2;
      await page.mouse.move(centerX, centerY);
      await page.waitForTimeout(100);
      const steps = 15;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        await page.mouse.move(
          centerX + (targetX - centerX) * t,
          centerY + (targetY - centerY) * t,
        );
        await page.waitForTimeout(20);
      }
      await page.waitForTimeout(150);
    }

    // Click the clone button
    await cloneBtn.click();
    await page.waitForTimeout(300);

    // Highlight the newly cloned card with a flash effect
    const cards = page.locator(".card");
    const newCardCount = await cards.count();
    if (newCardCount > 2) {
      // The cloned card appears after the original (index 1 for first card's clone)
      const newCard = cards.nth(1);
      await newCard.evaluate((el) => {
        el.style.transition = "box-shadow 0.3s ease-out, outline 0.3s ease-out";
        el.style.outline = "3px solid rgba(59, 130, 246, 0.8)";
        el.style.boxShadow =
          "0 0 24px rgba(59, 130, 246, 0.5), 0 0 48px rgba(59, 130, 246, 0.2)";
      });
      await page.waitForTimeout(600);
      await newCard.evaluate((el) => {
        el.style.outline = "3px solid rgba(59, 130, 246, 0.4)";
        el.style.boxShadow = "0 0 12px rgba(59, 130, 246, 0.3)";
      });
    }
    await page.waitForTimeout(400);

    const cloneOutPath = path.join(videoDir, "clone-template.webm");
    const cloneVideo = page.video();
    if (!cloneVideo) throw new Error("Video recording not available");
    await context.close();
    await cloneVideo.saveAs(cloneOutPath);
    await cloneVideo.delete();
  });

  test("search filter video", async ({ browser }) => {
    const videoDir = path.resolve(__dirname, "public/videos");
    fs.mkdirSync(videoDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      locale: "ja",
      colorScheme: "light",
      recordVideo: {
        dir: videoDir,
        size: { width: 1600, height: 900 },
      },
    });

    const page = await context.newPage();

    await page.route("**/example.com/profile.png", (route) =>
      route.fulfill({ path: avatarPath }),
    );
    await page.addInitScript(() => {
      window.__mockAuthToken = "test-token";
      localStorage.setItem("language", "ja");

      const ffGames = [
        { id: "7689", name: "FINAL FANTASY" },
        { id: "1918", name: "FINAL FANTASY II" },
        { id: "2014138189", name: "FINAL FANTASY III" },
        { id: "19023", name: "FINAL FANTASY IV" },
        { id: "1692274562", name: "Final Fantasy V" },
        { id: "858043689", name: "Final Fantasy VI" },
        { id: "11988", name: "FINAL FANTASY VII" },
        { id: "11282", name: "FINAL FANTASY VIII" },
        { id: "8090", name: "FINAL FANTASY IX" },
        { id: "10322", name: "FINAL FANTASY X" },
        { id: "10229", name: "FINAL FANTASY XI" },
        { id: "10564", name: "FINAL FANTASY XII" },
        { id: "18889", name: "FINAL FANTASY XIII" },
      ];
      const mockTemplates = ffGames.map((ff, i) => ({
        id: `template-ff${i + 1}`,
        title: `Final Fantasy ${i + 1}`,
        category: {
          id: ff.id,
          name: ff.name,
          box_art_url: `https://static-cdn.jtvnw.net/ttv-boxart/${ff.id}-{width}x{height}.jpg`,
        },
        tags: ["RPG"],
      }));
      localStorage.setItem("templates", JSON.stringify(mockTemplates));
    });

    await page.goto("/");
    await waitForApp(page);
    await page.locator(".card").first().waitFor({ state: "visible" });
    await injectVisibleCursor(page);
    await page.waitForTimeout(200);

    // Start cursor at screen center, move to search input
    const searchInput = page.locator("input[aria-label]").first();
    const searchBox = await searchInput.boundingBox();
    if (searchBox) {
      const centerX = 800;
      const centerY = 450;
      const targetX = searchBox.x + searchBox.width / 2;
      const targetY = searchBox.y + searchBox.height / 2;
      await page.mouse.move(centerX, centerY);
      await page.waitForTimeout(100);
      const steps = 15;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        await page.mouse.move(
          centerX + (targetX - centerX) * t,
          centerY + (targetY - centerY) * t,
        );
        await page.waitForTimeout(20);
      }
      await page.waitForTimeout(150);
    }

    // Click search input
    await searchInput.click();
    await page.waitForTimeout(300);

    // Type "1" → shows FF1, 10, 11, 12, 13
    await page.keyboard.type("1", { delay: 120 });
    await page.waitForTimeout(800);

    // Type another "1" → shows only FF11
    await page.keyboard.type("1", { delay: 120 });
    await page.waitForTimeout(800);

    const searchOutPath = path.join(videoDir, "search-filter.webm");
    const searchVideo = page.video();
    if (!searchVideo) throw new Error("Video recording not available");
    await context.close();
    await searchVideo.saveAs(searchOutPath);
    await searchVideo.delete();
  });

  // Write all computed highlights to JSON after all tests
  test("write highlights.json", async () => {
    const outPath = path.resolve(__dirname, "src/highlights.json");
    fs.writeFileSync(outPath, `${JSON.stringify(highlights, null, 2)}\n`);
  });
});
