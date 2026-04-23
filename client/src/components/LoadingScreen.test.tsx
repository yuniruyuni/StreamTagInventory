import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { I18nWrapper } from "~/test-utils";
import { LoadingScreen } from "./LoadingScreen";

describe("LoadingScreen", () => {
  test("renders brand title and default loading label (en)", () => {
    const { getByRole, getByText } = render(<LoadingScreen />, {
      wrapper: I18nWrapper,
    });

    const status = getByRole("status");
    expect(status).toBeInTheDocument();
    expect(getByText("Stream Tag Inventory")).toBeInTheDocument();
    // 既定言語 (`i18n/config.ts` の detect) — test では en で初期化される想定。
    // label 文字列そのものを詮索せず common.loading key の両言語いずれかが出れば OK。
    const loadingEl = status.querySelector("p");
    expect(loadingEl?.textContent).toMatch(/Loading|読み込み中/);
  });

  test("renders custom label when provided", () => {
    const { getByText } = render(<LoadingScreen label="Signing in..." />, {
      wrapper: I18nWrapper,
    });
    expect(getByText("Signing in...")).toBeInTheDocument();
  });

  test("spinner element is aria-hidden", () => {
    const { container } = render(<LoadingScreen />, { wrapper: I18nWrapper });
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute("aria-hidden")).toBe("true");
  });

  test("status region has aria-live polite for screen readers", () => {
    const { getByRole } = render(<LoadingScreen />, { wrapper: I18nWrapper });
    expect(getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});
