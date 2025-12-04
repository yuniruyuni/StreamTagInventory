import type { Page } from "@playwright/test";

export abstract class BaseActions {
  constructor(protected page: Page) {}

  async navigate(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async waitForLoadState(
    state: Parameters<Page["waitForLoadState"]>[0] = "networkidle",
  ): Promise<void> {
    await this.page.waitForLoadState(state);
  }

  async waitForTimeout(timeout: number): Promise<void> {
    await this.page.waitForTimeout(timeout);
  }

  async setViewportSize(size: {
    width: number;
    height: number;
  }): Promise<void> {
    await this.page.setViewportSize(size);
  }
}
