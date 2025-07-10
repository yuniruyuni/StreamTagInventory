import type { Locator } from "@playwright/test";
import { BasePage } from "../../../base/BasePage";

export class NavbarPage extends BasePage {
  get navbar(): Locator {
    return this.getLocator(".navbar");
  }

  get avatarButton(): Locator {
    return this.getLocator("button.avatar");
  }

  get userMenuDropdown(): Locator {
    return this.getLocator(".dropdown-content");
  }

  get logoutButton(): Locator {
    return this.getByRole("button").filter({ hasText: /logout|ログアウト/i });
  }
}