import { expect, type Page } from "@playwright/test";

export abstract class BaseState {
  constructor(protected page: Page) {}

  async expectTitle(title: string): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  async expectURL(url: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(url);
  }

  async expectScreenshot(name: string, options?: {
    animations?: "disabled" | "allow";
    fullPage?: boolean;
    mask?: Array<unknown>;
    maxDiffPixels?: number;
    maxDiffPixelRatio?: number;
    omitBackground?: boolean;
    timeout?: number;
  }): Promise<void> {
    await expect(this.page).toHaveScreenshot(name, options);
  }
}