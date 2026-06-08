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
    try {
      await this.navbarPage.avatarButton.click({ timeout: 5_000 });
    } catch {
      await this.navbarPage.avatarButton.click({ force: true });
    }
    await this.navbarPage.userMenuDropdown.waitFor({ state: "visible" });
  }

  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.navbarPage.logoutButton.click();
  }

  async searchTemplates(query: string): Promise<void> {
    await this.navbarPage.searchInput.fill(query);
  }

  async selectLanguage(language: "en" | "ja"): Promise<void> {
    await this.navbarPage.languageSelect.selectOption(language);
  }

  async openPostTemplateEditor(): Promise<void> {
    await this.openUserMenu();
    await this.navbarPage.postTemplateButton.click();
  }

  async importTemplates(): Promise<void> {
    await this.openUserMenu();
    await this.navbarPage.importTemplatesButton.click();
  }

  async exportTemplates(): Promise<void> {
    await this.openUserMenu();
    await this.navbarPage.exportTemplatesButton.click();
  }
}
