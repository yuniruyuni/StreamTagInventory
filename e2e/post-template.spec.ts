import { expect, test } from "@playwright/test";
import { setupMocks } from "./mocks/setupMocks";
import { NavbarScreen } from "./screens/components/navbar/NavbarScreen";
import { InventoryScreen } from "./screens/inventory/InventoryScreen";

async function openInventory(page: Parameters<typeof setupMocks>[0]) {
  await setupMocks(page);
  await page.goto("/");
  const inventoryScreen = new InventoryScreen(page);
  await inventoryScreen.actions.waitForAuthentication();
  await inventoryScreen.state.expectInventoryPageVisible();
  return inventoryScreen;
}

async function openPostTemplateEditor(page: Parameters<typeof setupMocks>[0]) {
  const navbarScreen = new NavbarScreen(page);
  await navbarScreen.actions.openPostTemplateEditor();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Post template settings", () => {
  test("opens, saves, and persists the post template editor", async ({
    page,
  }) => {
    await openInventory(page);

    const dialog = await openPostTemplateEditor(page);
    const textarea = dialog.getByRole("textbox", { name: "Post Template" });
    await expect(textarea).toBeVisible();
    await expect(dialog.getByText("Preview")).toBeVisible();

    const customTemplate = "Now live: {title} / {category} / {tags} / {url}";
    await textarea.fill(customTemplate);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();

    const reopened = await openPostTemplateEditor(page);
    await expect(
      reopened.getByRole("textbox", { name: "Post Template" }),
    ).toHaveValue(customTemplate);
  });

  test("cancel discards unsaved post template edits", async ({ page }) => {
    await openInventory(page);

    const dialog = await openPostTemplateEditor(page);
    const textarea = dialog.getByRole("textbox", { name: "Post Template" });
    const original = await textarea.inputValue();

    await textarea.fill("Unsaved custom template");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    const reopened = await openPostTemplateEditor(page);
    await expect(
      reopened.getByRole("textbox", { name: "Post Template" }),
    ).toHaveValue(original);
  });

  test("updates the preview when placeholders change", async ({ page }) => {
    await openInventory(page);

    const dialog = await openPostTemplateEditor(page);
    const textarea = dialog.getByRole("textbox", { name: "Post Template" });

    await textarea.fill("Live: {title} | {category} | {tags} | {url}");

    const preview = dialog.locator("pre");
    await expect(preview).toContainText("Live: Sample Stream Title");
    await expect(preview).toContainText("Apex Legends");
    await expect(preview).toContainText("FPS, Ranked, Stream");
    await expect(preview).toContainText("https://twitch.tv/username");
  });

  test("resets the post template to the default and persists it", async ({
    page,
  }) => {
    await openInventory(page);

    const dialog = await openPostTemplateEditor(page);
    const textarea = dialog.getByRole("textbox", { name: "Post Template" });
    await textarea.fill("Custom template that should be reset");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    const reopened = await openPostTemplateEditor(page);
    const reopenedTextarea = reopened.getByRole("textbox", {
      name: "Post Template",
    });
    await reopened.getByRole("button", { name: "Reset to Default" }).click();
    await expect(reopenedTextarea).not.toHaveValue(
      "Custom template that should be reset",
    );
    await expect(reopenedTextarea).toHaveValue(
      /\{title\}[\s\S]*\{category\}[\s\S]*\{tags\}[\s\S]*\{url\}/,
    );
    const resetValue = await reopenedTextarea.inputValue();
    await reopened.getByRole("button", { name: "Save" }).click();

    await page.reload();
    const inventoryScreen = new InventoryScreen(page);
    await inventoryScreen.actions.waitForAuthentication();

    const afterReload = await openPostTemplateEditor(page);
    await expect(
      afterReload.getByRole("textbox", { name: "Post Template" }),
    ).toHaveValue(resetValue);
  });
});
