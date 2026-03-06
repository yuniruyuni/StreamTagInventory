import type { Locator } from "@playwright/test";
import { BasePage } from "../../../base/BasePage";

export class NavbarPage extends BasePage {
  get navbar(): Locator {
    return this.getByRole("navigation", { name: "main" });
  }

  get avatarButton(): Locator {
    return this.getByRole("button", { name: "user menu" });
  }

  get userMenuDropdown(): Locator {
    return this.getByRole("menu", { name: "user menu" });
  }

  get logoutButton(): Locator {
    return this.getByRole("button").filter({ hasText: /logout|ログアウト/i });
  }
}
