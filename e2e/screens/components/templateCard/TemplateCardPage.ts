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
    return this.cardLocator.getByRole("combobox");
  }

  get titleInput(): Locator {
    return this.cardLocator.getByRole("textbox", { name: /title|タイトル/i });
  }

  get categoryDropdown(): Locator {
    return this.cardLocator.getByRole("listbox");
  }

  get saveButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "save template" });
  }

  get applyButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "apply template" });
  }

  get revertButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "revert template" });
  }

  get tags(): Locator {
    return this.cardLocator.getByRole("listitem");
  }

  getCategoryOption(name: string): Locator {
    return this.categoryDropdown.getByText(name);
  }
}
