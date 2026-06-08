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

  get searchInput(): Locator {
    return this.navbar.getByRole("textbox", { name: /search|検索/i });
  }

  get languageSelect(): Locator {
    return this.navbar.getByRole("combobox", { name: /select language/i });
  }

  get postTemplateButton(): Locator {
    return this.getByRole("button", {
      name: /post template|投稿テンプレート/i,
    });
  }

  get importTemplatesButton(): Locator {
    return this.userMenuDropdown.getByRole("button", {
      name: /^import|^インポート/i,
    });
  }

  get exportTemplatesButton(): Locator {
    return this.userMenuDropdown.getByRole("button", {
      name: /^export|^エクスポート/i,
    });
  }
}
