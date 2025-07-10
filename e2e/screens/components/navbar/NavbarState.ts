import { expect, type Page } from "@playwright/test";
import { BaseState } from "../../../base/BaseState";
import { NavbarPage } from "./NavbarPage";

export class NavbarState extends BaseState {
  private navbarPage: NavbarPage;

  constructor(page: Page) {
    super(page);
    this.navbarPage = new NavbarPage(page);
  }

  async expectAvatarButtonVisible(): Promise<void> {
    await expect(this.navbarPage.avatarButton).toBeVisible();
  }

  async expectUserMenuDropdownVisible(): Promise<void> {
    await expect(this.navbarPage.userMenuDropdown).toBeVisible();
  }

  async expectNavbarScreenshot(name: string): Promise<void> {
    await expect(this.navbarPage.navbar).toHaveScreenshot(name, {
      animations: "disabled",
    });
  }
}