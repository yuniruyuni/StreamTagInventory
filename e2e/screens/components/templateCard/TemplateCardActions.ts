import type { Locator, Page } from "@playwright/test";
import { BaseActions } from "../../../base/BaseActions";
import { TemplateCardPage } from "./TemplateCardPage";

export class TemplateCardActions extends BaseActions {
  private templateCardPage: TemplateCardPage;

  constructor(
    page: Page,
    cardLocator: Locator,
  ) {
    super(page);
    this.templateCardPage = new TemplateCardPage(page, cardLocator);
  }

  async searchCategory(query: string): Promise<void> {
    await this.templateCardPage.categoryInput.click();
    await this.templateCardPage.categoryInput.clear();
    await this.templateCardPage.categoryInput.fill(query);
    await this.waitForTimeout(500); // Debounce delay
  }

  async selectCategory(name: string): Promise<void> {
    await this.templateCardPage.getCategoryOption(name).click();
  }

  async updateTitle(newTitle: string): Promise<void> {
    await this.templateCardPage.titleInput.click();
    await this.templateCardPage.titleInput.clear();
    await this.templateCardPage.titleInput.fill(newTitle);
  }

  async saveTemplate(): Promise<void> {
    await this.templateCardPage.saveButton.click();
  }

  async applyTemplate(): Promise<void> {
    await this.templateCardPage.applyButton.click();
  }

  async revertChanges(): Promise<void> {
    await this.templateCardPage.revertButton.click();
  }

  async waitForCategoryDropdown(): Promise<void> {
    await this.templateCardPage.categoryDropdown.waitFor({
      state: "visible",
    });
  }
}