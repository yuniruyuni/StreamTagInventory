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
    page.getByRole("heading", { name: /^ライセンス本文/ }),
  ).toHaveCount(0);

  const reactComponent = page.locator("details.component").filter({
    has: page.locator(".component-name", { hasText: /^react\s/ }),
  });
  const reactLicenseDocument = reactComponent
    .locator(".license-document")
    .first();

  await expect(reactComponent).toHaveCount(1);
  await expect(reactLicenseDocument).toBeHidden();
  await reactComponent.locator("summary").click();
  await expect(reactLicenseDocument).toBeVisible();
  await expect(reactLicenseDocument.locator("pre")).toContainText(
    "MIT License",
  );

  const firstComponent = page.locator("details.component").first();
  await firstComponent.locator("summary").click();
  await expect(
    firstComponent.locator(".license-document").first(),
  ).toBeVisible();
  await expect(reactLicenseDocument).toBeHidden();
});
