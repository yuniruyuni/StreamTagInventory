import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type React from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "./config";

// テスト用の簡易コンポーネント
const TestComponent = () => {
  const { t } = useTranslation();
  return (
    <div>
      <div data-testid="loading">{t("common.loading")}</div>
      <div data-testid="save">{t("common.save")}</div>
      <div data-testid="login">{t("auth.login")}</div>
      <div data-testid="title">{t("template.title")}</div>
    </div>
  );
};

// テスト用のラッパーコンポーネント
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

test("i18n > 英語の翻訳が正しく機能すること", async () => {
  // 言語を英語に変更
  await i18n.changeLanguage("en");

  const { getByTestId } = render(<TestComponent />, { wrapper: TestWrapper });

  expect(getByTestId("loading").textContent).toBe("Loading...");
  expect(getByTestId("save").textContent).toBe("Save");
  expect(getByTestId("login").textContent).toBe("Login with Twitch");
  expect(getByTestId("title").textContent).toBe("Title");
});

test("i18n > 日本語の翻訳が正しく機能すること", async () => {
  // 言語を日本語に変更
  await i18n.changeLanguage("ja");

  const { getByTestId } = render(<TestComponent />, { wrapper: TestWrapper });

  expect(getByTestId("loading").textContent).toBe("読み込み中...");
  expect(getByTestId("save").textContent).toBe("保存");
  expect(getByTestId("login").textContent).toBe("Twitchでログイン");
  expect(getByTestId("title").textContent).toBe("タイトル");
});
