import type { Locator } from "@playwright/test";
import { BasePage } from "../../../base/BasePage";

export class NavbarPage extends BasePage {
  get navbar(): Locator {
    return this.getByTestId("navbar");
  }

  get avatarButton(): Locator {
    return this.getByTestId("avatar-button");
  }

  get userMenuDropdown(): Locator {
    return this.getByTestId("user-menu");
  }

  get logoutButton(): Locator {
    return this.getByRole("button").filter({ hasText: /logout|ログアウト/i });
  }
}
