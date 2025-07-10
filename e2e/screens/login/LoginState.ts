import { expect, type Page } from "@playwright/test";
import { BaseState } from "../../base/BaseState";
import { LoginPage } from "./LoginPage";

export class LoginState extends BaseState {
  private loginPage: LoginPage;

  constructor(page: Page) {
    super(page);
    this.loginPage = new LoginPage(page);
  }

  async expectLoginPageVisible(): Promise<void> {
    await expect(this.loginPage.title).toBeVisible();
    await expect(this.loginPage.loginButton).toBeVisible();
  }

  async expectLoginPageTitle(): Promise<void> {
    await this.expectTitle("Stream Tag Inventory");
  }
}