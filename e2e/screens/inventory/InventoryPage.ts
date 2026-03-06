import type { Locator } from "@playwright/test";
import { BasePage } from "../../base/BasePage";

export class InventoryPage extends BasePage {
  get pageTitle(): Locator {
    return this.getByText("Stream Tag Inventory").first();
  }

  get userAvatar(): Locator {
    return this.getByTestId("avatar-button");
  }

  get navbar(): Locator {
    return this.getByTestId("navbar");
  }

  get userMenuDropdown(): Locator {
    return this.getByTestId("user-menu");
  }

  get logoutButton(): Locator {
    return this.getByRole("button").filter({ hasText: /logout|ログアウト/i });
  }

  get templateCards(): Locator {
    return this.getByTestId("template-card");
  }

  templateCard(index: number): Locator {
    return this.templateCards.nth(index);
  }
}
