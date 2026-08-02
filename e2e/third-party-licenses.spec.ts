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
  await expect(
    page.getByText(
      "Stream Tag Inventoryで使用している第三者ソフトウェアのライセンス情報です。",
    ),
  ).toBeVisible();
  await expect(page.getByText("対象範囲")).toHaveCount(0);
  await expect(page.getByText(/bun\.lock SHA-256/)).toHaveCount(0);
  await expect(page.locator("details.component").first()).toBeVisible();
  await expect(
    page.locator(".component-name").filter({ hasText: /^react\s/ }),
  ).toBeVisible();
});
