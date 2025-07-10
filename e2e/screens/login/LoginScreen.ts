import type { Page } from "@playwright/test";
import { BaseScreen } from "../../base/BaseScreen";
import { LoginActions } from "./LoginActions";
import { LoginPage } from "./LoginPage";
import { LoginState } from "./LoginState";

export class LoginScreen extends BaseScreen<
  LoginPage,
  LoginActions,
  LoginState
> {
  constructor(page: Page) {
    super(
      page,
      new LoginPage(page),
      new LoginActions(page),
      new LoginState(page),
    );
  }
}