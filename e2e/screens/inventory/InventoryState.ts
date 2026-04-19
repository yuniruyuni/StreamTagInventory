import { expect, type Page } from "@playwright/test";
import { BaseState } from "../../base/BaseState";
import { InventoryPage } from "./InventoryPage";

export class InventoryState extends BaseState {
  private inventoryPage: InventoryPage;

  constructor(page: Page) {
    super(page);
    this.inventoryPage = new InventoryPage(page);
  }

  async expectInventoryPageVisible(): Promise<void> {
    await expect(this.inventoryPage.pageTitle).toBeVisible();
    await expect(this.inventoryPage.userAvatar).toBeVisible();
  }

  async expectUserMenuDropdownVisible(): Promise<void> {
    await expect(this.inventoryPage.userMenuDropdown).toBeVisible();
  }

  async expectTemplateCardsVisible(): Promise<void> {
    const cards = await this.inventoryPage.templateCards.count();
    expect(cards).toBeGreaterThan(0);
  }

  async expectRedirectedToLogin(): Promise<void> {
    // Entrance には複数のリンク (Login with Twitch / author info) が並ぶため、
    // 明示的に "Login with Twitch" を狙って strict mode 違反を避ける。
    await expect(
      this.page.getByRole("link", { name: "Login with Twitch" }),
    ).toBeVisible();
  }
}
