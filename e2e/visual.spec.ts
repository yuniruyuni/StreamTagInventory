import { expect, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";

test.describe("Visual Regression Tests - Unauthenticated", () => {
  test("login page", async ({ page }) => {
    await page.goto("/");

    // Wait for the page to fully load
    await expect(page.getByText("Stream Tag Inventory")).toBeVisible();

    // Wait for CSS to load
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000); // Wait for CSS to be applied

    // Take screenshot of the login page
    await expect(page).toHaveScreenshot("login-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});

test.describe("Visual Regression Tests - Authenticated", () => {
  test.beforeEach(async ({ page }) => {
    // Setup mocks and authentication
    await setupMocks(page);
    await page.goto("/");

    // Wait for page to load
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle");
    await page.locator(".avatar").waitFor({ state: "visible", timeout: 10000 });

    // Additional wait for CSS to be fully applied
    await page.waitForTimeout(2000);
  });

  test("main inventory page", async ({ page }) => {
    // Wait for the page to stabilize
    await page.waitForLoadState("networkidle");

    // Take screenshot of the main page
    await expect(page).toHaveScreenshot("main-inventory-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("template card", async ({ page }) => {
    // Wait for template cards to be visible
    await page.locator(".card").first().waitFor({ state: "visible" });

    // Take screenshot of the first template card
    await expect(page.locator(".card").first()).toHaveScreenshot(
      "template-card.png",
      {
        animations: "disabled",
      },
    );
  });

  test("category dropdown open", async ({ page }) => {
    // Click on category input to open dropdown
    const categoryInput = page.locator(".card #category").first();
    await categoryInput.click();

    // Wait for dropdown to appear
    await page.locator('[data-testid="dropdown-content"]').waitFor({
      state: "visible",
    });

    // Take screenshot of the dropdown
    await expect(page.locator(".card").first()).toHaveScreenshot(
      "category-dropdown.png",
      {
        animations: "disabled",
      },
    );
  });

  test("tag input interface", async ({ page }) => {
    // Focus on the tag input area
    const tagSection = page.locator(".card").first();

    // Take screenshot of the tag input section
    await expect(tagSection).toHaveScreenshot("tag-input.png", {
      animations: "disabled",
    });
  });

  test("user menu dropdown", async ({ page }) => {
    // Click on avatar to open user menu
    await page.locator("button.avatar").click();

    // Wait for dropdown menu to appear
    await page.locator(".dropdown-content").waitFor({ state: "visible" });

    // Take screenshot of the navbar with open dropdown
    await expect(page.locator(".navbar")).toHaveScreenshot(
      "user-menu-dropdown.png",
      {
        animations: "disabled",
      },
    );
  });

  test("template with changes", async ({ page }) => {
    // Make a change to trigger the save/revert buttons
    const titleInput = page.locator('.card input[name="title"]').first();
    await titleInput.click();
    await titleInput.clear();
    await titleInput.fill("Modified Title");

    // Wait for buttons to appear (using aria-label for language independence)
    await page
      .locator('.card button[aria-label="save template"]')
      .first()
      .waitFor({
        state: "visible",
      });

    // Take screenshot showing save/revert buttons
    await expect(page.locator(".card").first()).toHaveScreenshot(
      "template-card-modified.png",
      {
        animations: "disabled",
      },
    );
  });
});

test.describe("Visual Regression Tests - Responsive", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");

    // Wait for page to load
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle");
    await page.locator(".avatar").waitFor({ state: "visible", timeout: 10000 });

    // Additional wait for CSS to be fully applied
    await page.waitForTimeout(2000);
  });

  test("mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for responsive adjustments
    await page.waitForTimeout(500);

    // Take screenshot of mobile view
    await expect(page).toHaveScreenshot("mobile-view.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("tablet viewport", async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Wait for responsive adjustments
    await page.waitForTimeout(500);

    // Take screenshot of tablet view
    await expect(page).toHaveScreenshot("tablet-view.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
