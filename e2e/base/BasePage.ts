import type { Locator, Page } from "@playwright/test";

export abstract class BasePage {
  constructor(protected page: Page) {}

  protected getLocator(selector: string): Locator {
    return this.page.locator(selector);
  }

  protected getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  protected getByRole(
    role: Parameters<Page["getByRole"]>[0],
    options?: Parameters<Page["getByRole"]>[1],
  ): Locator {
    return this.page.getByRole(role, options);
  }

  protected getByText(
    text: string | RegExp,
    options?: Parameters<Page["getByText"]>[1],
  ): Locator {
    return this.page.getByText(text, options);
  }
}