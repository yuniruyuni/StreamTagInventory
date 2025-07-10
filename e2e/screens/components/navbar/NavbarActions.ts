import type { Page } from "@playwright/test";
import { BaseActions } from "../../../base/BaseActions";
import { NavbarPage } from "./NavbarPage";

export class NavbarActions extends BaseActions {
  private navbarPage: NavbarPage;

  constructor(page: Page) {
    super(page);
    this.navbarPage = new NavbarPage(page);
  }

  async openUserMenu(): Promise<void> {
    await this.navbarPage.avatarButton.click();
    await this.navbarPage.userMenuDropdown.waitFor({ state: "visible" });
  }

  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.navbarPage.logoutButton.click();
  }
}