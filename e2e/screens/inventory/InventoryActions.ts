import type { Page } from "@playwright/test";
import { BaseActions } from "../../base/BaseActions";
import { InventoryPage } from "./InventoryPage";

export class InventoryActions extends BaseActions {
  private inventoryPage: InventoryPage;

  constructor(page: Page) {
    super(page);
    this.inventoryPage = new InventoryPage(page);
  }

  async waitForAuthentication(): Promise<void> {
    await this.inventoryPage.userAvatar.waitFor({
      state: "visible",
      timeout: 10000,
    });
  }

  async openUserMenu(): Promise<void> {
    await this.inventoryPage.userAvatar.click();
  }

  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.inventoryPage.logoutButton.click();
  }
}