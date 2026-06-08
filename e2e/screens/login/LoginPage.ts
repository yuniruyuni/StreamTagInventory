import type { Locator } from "@playwright/test";
import { BasePage } from "../../base/BasePage";

export class LoginPage extends BasePage {
  get title(): Locator {
    return this.getByText("Stream Tag Inventory");
  }

  get loginButton(): Locator {
    return this.getByRole("link", { name: /login|ログイン/i });
  }

  get loginContainer(): Locator {
    return this.getByRole("main");
  }
}
