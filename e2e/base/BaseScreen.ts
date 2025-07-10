import type { Page } from "@playwright/test";
import type { BaseActions } from "./BaseActions";
import type { BasePage } from "./BasePage";
import type { BaseState } from "./BaseState";

export abstract class BaseScreen<
  TPage extends BasePage,
  TActions extends BaseActions,
  TState extends BaseState,
> {
  constructor(
    protected page: Page,
    public readonly elements: TPage,
    public readonly actions: TActions,
    public readonly state: TState,
  ) {}
}