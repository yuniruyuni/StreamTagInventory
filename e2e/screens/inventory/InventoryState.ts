import { expect, type Page } from "@playwright/test";
import { BaseState } from "../../base/BaseState";
import { InventoryPage } from "./InventoryPage";

export class InventoryState extends BaseState {
  private inventoryPage: InventoryPage;

  constructor(page: Page) {
    super(page);
    this.inventoryPage = new InventoryPage(page);
  }

  async expectInventoryPageVisible(): Promise<void> {
    await expect(this.inventoryPage.pageTitle).toBeVisible();
    await expect(this.inventoryPage.userAvatar).toBeVisible();
  }

  async expectUserMenuDropdownVisible(): Promise<void> {
    await expect(this.inventoryPage.userMenuDropdown).toBeVisible();
  }

  async expectTemplateCardsVisible(): Promise<void> {
    const cards = await this.inventoryPage.templateCards.count();
    expect(cards).toBeGreaterThan(0);
  }

  async expectTemplateCardCount(count: number): Promise<void> {
    await expect(this.inventoryPage.templateCards).toHaveCount(count);
  }

  async expectTemplateTitlesInOrder(titles: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.inventoryPage.templateCards.evaluateAll((cards) =>
          cards.map(
            (card) =>
              card.querySelector<HTMLInputElement>("input[id^='title-']")
                ?.value ?? "",
          ),
        ),
      )
      .toEqual(titles);
  }

  async expectAddTemplateButtonVisible(): Promise<void> {
    await expect(this.inventoryPage.addTemplateButton).toBeVisible();
  }

  async expectAddTemplateCardWithinViewport(): Promise<void> {
    const box = await this.inventoryPage.addTemplateCard.boundingBox();
    expect(box).not.toBeNull();
    const viewport = this.page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) return;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  }

  async expectRedirectedToLogin(): Promise<void> {
    // Entrance には複数のリンク (Login with Twitch / author info) が並ぶため、
    // 明示的に "Login with Twitch" を狙って strict mode 違反を避ける。
    await expect(
      this.page.getByRole("link", { name: "Login with Twitch" }),
    ).toBeVisible();
  }
}
