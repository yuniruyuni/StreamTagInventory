import type { Page } from "@playwright/test";
import { BaseScreen } from "../../../base/BaseScreen";
import { NavbarActions } from "./NavbarActions";
import { NavbarPage } from "./NavbarPage";
import { NavbarState } from "./NavbarState";

export class NavbarScreen extends BaseScreen<
  NavbarPage,
  NavbarActions,
  NavbarState
> {
  constructor(page: Page) {
    super(
      page,
      new NavbarPage(page),
      new NavbarActions(page),
      new NavbarState(page),
    );
  }
}
