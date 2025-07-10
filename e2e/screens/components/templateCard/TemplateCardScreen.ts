import type { Locator, Page } from "@playwright/test";
import { BaseScreen } from "../../../base/BaseScreen";
import { TemplateCardActions } from "./TemplateCardActions";
import { TemplateCardPage } from "./TemplateCardPage";
import { TemplateCardState } from "./TemplateCardState";

export class TemplateCardScreen extends BaseScreen<
  TemplateCardPage,
  TemplateCardActions,
  TemplateCardState
> {
  constructor(page: Page, cardLocator: Locator) {
    super(
      page,
      new TemplateCardPage(page, cardLocator),
      new TemplateCardActions(page, cardLocator),
      new TemplateCardState(page, cardLocator),
    );
  }
}