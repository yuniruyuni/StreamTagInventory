import { expect, type Locator, type Page } from "@playwright/test";
import { BaseState } from "../../../base/BaseState";
import { TemplateCardPage } from "./TemplateCardPage";

export class TemplateCardState extends BaseState {
  private templateCardPage: TemplateCardPage;

  constructor(page: Page, cardLocator: Locator) {
    super(page);
    this.templateCardPage = new TemplateCardPage(page, cardLocator);
  }

  async expectCategoryValue(expectedValue: string): Promise<void> {
    await expect(this.templateCardPage.categoryInput).toHaveValue(
      expectedValue,
    );
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

  async expectApplyButtonDisabled(): Promise<void> {
    await expect(this.templateCardPage.applyButton).toBeDisabled();
  }

  async expectSaveButtonHidden(): Promise<void> {
    await expect(this.templateCardPage.saveButton).toBeHidden();
  }

  async expectRevertButtonVisible(): Promise<void> {
    await expect(this.templateCardPage.revertButton).toBeVisible();
  }

  async expectRevertButtonHidden(): Promise<void> {
    await expect(this.templateCardPage.revertButton).toBeHidden();
  }

  async expectTagsVisible(): Promise<void> {
    await expect(this.templateCardPage.tags.first()).toBeVisible();
  }

  async expectTagVisible(name: string): Promise<void> {
    await expect(this.templateCardPage.getEditTagButton(name)).toBeVisible();
  }

  async expectTagHidden(name: string): Promise<void> {
    await expect(this.templateCardPage.getEditTagButton(name)).toBeHidden();
  }

  async expectTagCount(count: number): Promise<void> {
    await expect(this.templateCardPage.tags).toHaveCount(count);
  }

  async expectTagInputHidden(): Promise<void> {
    await expect(this.templateCardPage.tagInput).toBeHidden();
  }

  async expectTagCounterText(text: string): Promise<void> {
    await expect(this.templateCardPage.tagCounter).toHaveText(text);
  }

  async expectTagTextsInOrder(tags: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.templateCardPage.tags.evaluateAll((items) =>
          items.map((item) =>
            (item.textContent ?? "").replace(/remove tag/i, "").trim(),
          ),
        ),
      )
      .toEqual(tags);
  }

  async expectAnnounceOnXVisible(): Promise<void> {
    await expect(this.templateCardPage.announceOnXButton).toBeVisible();
  }

  async expectAnnounceOnXHidden(): Promise<void> {
    await expect(this.templateCardPage.announceOnXButton).toBeHidden();
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
