import type { Locator } from "@playwright/test";
import { BasePage } from "../../base/BasePage";

export class InventoryPage extends BasePage {
  get pageTitle(): Locator {
    return this.getByText("Stream Tag Inventory").first();
  }

  get userAvatar(): Locator {
    return this.getLocator("button.avatar");
  }

  get navbar(): Locator {
    return this.getLocator(".navbar");
  }

  get userMenuDropdown(): Locator {
    return this.getLocator(".dropdown-content");
  }

  get logoutButton(): Locator {
    return this.getByRole("button").filter({ hasText: /logout|ログアウト/i });
  }

  get templateCards(): Locator {
    return this.getLocator(".card");
  }

  templateCard(index: number): Locator {
    return this.templateCards.nth(index);
  }
}
