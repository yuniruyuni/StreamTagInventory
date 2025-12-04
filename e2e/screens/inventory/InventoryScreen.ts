import type { Page } from "@playwright/test";
import { BaseScreen } from "../../base/BaseScreen";
import { TemplateCardScreen } from "../components/templateCard/TemplateCardScreen";
import { InventoryActions } from "./InventoryActions";
import { InventoryPage } from "./InventoryPage";
import { InventoryState } from "./InventoryState";

export class InventoryScreen extends BaseScreen<
  InventoryPage,
  InventoryActions,
  InventoryState
> {
  constructor(page: Page) {
    super(
      page,
      new InventoryPage(page),
      new InventoryActions(page),
      new InventoryState(page),
    );
  }

  getTemplateCardScreen(index: number) {
    const cardLocator = this.elements.templateCard(index);
    return new TemplateCardScreen(this.page, cardLocator);
  }
}
