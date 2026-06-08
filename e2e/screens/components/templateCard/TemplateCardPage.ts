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

  get tagInput(): Locator {
    return this.cardLocator.getByRole("textbox", { name: /tags|タグ/i });
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

  get cloneButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "clone template" });
  }

  get removeButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "remove template" });
  }

  get revertButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "revert template" });
  }

  get tags(): Locator {
    return this.cardLocator.getByRole("listitem");
  }

  get tagCounter(): Locator {
    return this.cardLocator.getByTestId("tag-counter");
  }

  get announceOnXButton(): Locator {
    return this.cardLocator.getByRole("button", { name: "announce on x" });
  }

  get dragHandle(): Locator {
    return this.cardLocator.getByRole("button", { name: /drag handle/i });
  }

  getCategoryOption(name: string): Locator {
    return this.categoryDropdown.getByText(name);
  }

  getEditTagButton(name: string): Locator {
    return this.cardLocator.getByRole("button", { name: `edit tag ${name}` });
  }

  getRemoveTagButton(index: number): Locator {
    return this.cardLocator
      .getByRole("button", { name: "remove tag" })
      .nth(index);
  }
}
