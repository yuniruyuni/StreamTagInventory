import { expect, test } from "@playwright/test";

test("generated third-party license page is publicly available", async ({
  page,
}) => {
  await page.goto("/third-party-licenses.html");

  await expect(page).toHaveTitle(
    "サードパーティライセンス | Stream Tag Inventory",
  );
  await expect(
    page.getByRole("heading", { name: "サードパーティライセンス" }),
  ).toBeVisible();
  await expect(page.locator("details.component").first()).toBeVisible();
  await expect(
    page.locator(".component-name").filter({ hasText: /^react\s/ }),
  ).toBeVisible();
});
