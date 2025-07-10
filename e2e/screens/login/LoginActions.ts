import type { Page } from "@playwright/test";
import { BaseActions } from "../../base/BaseActions";
import { LoginPage } from "./LoginPage";

export class LoginActions extends BaseActions {
  private loginPage: LoginPage;

  constructor(page: Page) {
    super(page);
    this.loginPage = new LoginPage(page);
  }

  async goToLoginPage(): Promise<void> {
    await this.navigate("/");
  }

  async clickLoginButton(): Promise<void> {
    await this.loginPage.loginButton.click();
  }
}