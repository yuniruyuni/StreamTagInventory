import type { Locator, Page } from "@playwright/test";
import { BasePage } from "../../../base/BasePage";

export class TemplateCardPage extends BasePage {
  constructor(
    page: Page,
    public readonly cardLocator: Locator,
  ) {
    super(page);
  }

  get categoryInput(): Locator {
    return this.cardLocator.locator("#category");
  }

  get titleInput(): Locator {
    return this.cardLocator.locator('input[name="title"]');
  }

  get categoryDropdown(): Locator {
    return this.getByTestId("combobox-dropdown");
  }

  get saveButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "save template" });
  }

  get applyButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "apply template" });
  }

  get revertButton(): Locator {
    return this.cardLocator.locator('button[aria-label="revert changes"]');
  }

  get tags(): Locator {
    return this.cardLocator.getByTestId("tag");
  }

  getCategoryOption(name: string): Locator {
    return this.categoryDropdown.getByText(name);
  }
}
