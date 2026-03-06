import type { Locator } from "@playwright/test";
import { BasePage } from "../../base/BasePage";

export class InventoryPage extends BasePage {
  get pageTitle(): Locator {
    return this.getByText("Stream Tag Inventory").first();
  }

  get userAvatar(): Locator {
    return this.getByRole("button", { name: "user menu" });
  }

  get navbar(): Locator {
    return this.getByRole("navigation", { name: "main" });
  }

  get userMenuDropdown(): Locator {
    return this.getByRole("menu", { name: "user menu" });
  }

  get logoutButton(): Locator {
    return this.getByRole("button").filter({ hasText: /logout|ログアウト/i });
  }

  get templateCards(): Locator {
    return this.getByRole("article");
  }

  templateCard(index: number): Locator {
    return this.templateCards.nth(index);
  }
}
