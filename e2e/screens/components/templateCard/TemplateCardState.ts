import { expect, type Locator, type Page } from "@playwright/test";
import { BaseState } from "../../../base/BaseState";
import { TemplateCardPage } from "./TemplateCardPage";

export class TemplateCardState extends BaseState {
  private templateCardPage: TemplateCardPage;

  constructor(
    page: Page,
    cardLocator: Locator,
  ) {
    super(page);
    this.templateCardPage = new TemplateCardPage(page, cardLocator);
  }

  async expectCategoryValue(expectedValue: string): Promise<void> {
    await expect(this.templateCardPage.categoryInput).toHaveValue(expectedValue);
  }

  async expectTitleValue(expectedValue: string): Promise<void> {
    await expect(this.templateCardPage.titleInput).toHaveValue(expectedValue);
  }

  async expectCategoryDropdownVisible(): Promise<void> {
    await expect(this.templateCardPage.categoryDropdown).toBeVisible();
  }

  async expectCategoryOptionVisible(name: string): Promise<void> {
    await expect(this.templateCardPage.getCategoryOption(name)).toBeVisible();
  }

  async expectSaveButtonVisible(): Promise<void> {
    await expect(this.templateCardPage.saveButton).toBeVisible();
  }

  async expectApplyButtonVisible(): Promise<void> {
    await expect(this.templateCardPage.applyButton).toBeVisible();
  }

  async expectTagsVisible(): Promise<void> {
    await expect(this.templateCardPage.tags.first()).toBeVisible();
  }

  async expectCardScreenshot(name: string): Promise<void> {
    const cardElement = await this.templateCardPage.cardLocator.elementHandle();
    if (cardElement) {
      await expect(this.templateCardPage.cardLocator).toHaveScreenshot(name, {
        animations: "disabled",
      });
    }
  }
}