import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { BaseActions } from "../../../base/BaseActions";
import { TemplateCardPage } from "./TemplateCardPage";

export class TemplateCardActions extends BaseActions {
  private templateCardPage: TemplateCardPage;

  constructor(page: Page, cardLocator: Locator) {
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

  async selectCategoryWithKeyboard(
    query: string,
    arrowDownCount = 1,
  ): Promise<void> {
    await this.templateCardPage.categoryInput.click();
    await this.templateCardPage.categoryInput.clear();
    await this.templateCardPage.categoryInput.fill(query);
    await this.waitForTimeout(500);
    for (let i = 0; i < arrowDownCount; i++) {
      await this.templateCardPage.categoryInput.press("ArrowDown");
    }
    await this.templateCardPage.categoryInput.press("Enter");
  }

  async updateTitle(newTitle: string): Promise<void> {
    await this.templateCardPage.titleInput.click();
    await this.templateCardPage.titleInput.clear();
    await this.templateCardPage.titleInput.fill(newTitle);
  }

  async addTag(tag: string): Promise<void> {
    await this.templateCardPage.tagInput.click();
    await this.templateCardPage.tagInput.fill(tag);
    await this.templateCardPage.tagInput.press("Enter");
  }

  async removeLastTagWithBackspace(): Promise<void> {
    await this.templateCardPage.tagInput.click();
    await this.templateCardPage.tagInput.fill("");
    await this.templateCardPage.tagInput.press("Backspace");
  }

  async pressComposingEnterInTagInput(value: string): Promise<void> {
    await this.templateCardPage.tagInput.click();
    await this.templateCardPage.tagInput.fill(value);
    await this.templateCardPage.tagInput.evaluate((input) => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "isComposing", {
        configurable: true,
        get: () => true,
      });
      input.dispatchEvent(event);
    });
  }

  async removeTag(index: number): Promise<void> {
    await this.templateCardPage.getRemoveTagButton(index).click();
  }

  async editTag(current: string, next: string): Promise<void> {
    await this.templateCardPage.getEditTagButton(current).click();
    const input = this.templateCardPage.cardLocator.getByRole("textbox", {
      name: "edit tag",
    });
    await input.fill(next);
    await input.press("Enter");
  }

  async saveTemplate(): Promise<void> {
    await this.templateCardPage.saveButton.click();
  }

  async applyTemplate(): Promise<void> {
    await this.templateCardPage.applyButton.click();
  }

  async announceOnX(): Promise<void> {
    await this.templateCardPage.announceOnXButton.click();
  }

  async cloneTemplate(): Promise<void> {
    await this.templateCardPage.cloneButton.click();
  }

  async removeTemplate(): Promise<void> {
    await this.templateCardPage.removeButton.click();
  }

  async revertChanges(): Promise<void> {
    await this.templateCardPage.revertButton.click();
  }

  async waitForCategoryDropdown(): Promise<void> {
    await this.templateCardPage.categoryDropdown.waitFor({
      state: "visible",
    });
  }

  async dragHandleTo(target: Locator): Promise<void> {
    const sourceBox = await this.templateCardPage.dragHandle.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    if (!sourceBox || !targetBox) return;

    await this.templateCardPage.dragHandle.dragTo(target, {
      sourcePosition: {
        x: sourceBox.width / 2,
        y: sourceBox.height / 2,
      },
      targetPosition: {
        x: targetBox.width / 2,
        y: Math.min(24, targetBox.height / 4),
      },
    });
  }

  async reorderWithKeyboard(keys: string[]): Promise<void> {
    await this.templateCardPage.dragHandle.focus();
    for (const key of keys) {
      await this.templateCardPage.dragHandle.press(key);
    }
  }

  async dragTagTo(tagName: string, targetTagName: string): Promise<void> {
    const source = this.templateCardPage.cardLocator
      .getByRole("listitem")
      .filter({ hasText: tagName });
    const target = this.templateCardPage.cardLocator
      .getByRole("listitem")
      .filter({ hasText: targetTagName });
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    if (!sourceBox || !targetBox) return;

    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await this.page.mouse.down();
    await this.page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 12 },
    );
    await this.page.mouse.up();
  }
}
