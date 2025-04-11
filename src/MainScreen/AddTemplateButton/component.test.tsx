import { beforeAll, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "~/i18n/config";
import { type Template, newTemplate } from "~/model/template";
import { AddTemplateButton } from "./component";

// テスト用のラッパーコンポーネント
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// テスト実行前にi18nを英語に設定
beforeAll(async () => {
  await i18n.changeLanguage("en");
});

test("AddTemplateButtonコンポーネントが正しくレンダリングされる", () => {
  const templates: Template[] = [];
  const setTemplates = () => {};

  const { getByRole } = render(
    <AddTemplateButton templates={templates} setTemplates={setTemplates} />,
    { wrapper: TestWrapper },
  );

  // ボタン要素が存在することを確認
  const button = getByRole("button");
  expect(button).not.toBeNull();
  expect(button).toHaveTextContent("Add");
  expect(button).toHaveClass("btn-primary");
});

test("ボタンをクリックすると、新しいテンプレートが追加される", async () => {
  const templates: Template[] = [];
  let newTemplates: Template[] = [];
  const setTemplates = (updatedTemplates: Template[]) => {
    newTemplates = updatedTemplates;
  };
  const { getByRole } = render(
    <AddTemplateButton templates={templates} setTemplates={setTemplates} />,
    { wrapper: TestWrapper },
  );

  // ボタン要素を取得
  const button = getByRole("button");
  expect(button).not.toBeNull();

  const user = userEvent.setup();
  await user.click(button);

  expect(newTemplates.length).toBe(1);
  expect(newTemplates[0]).toEqual({
    id: newTemplates[0].id, // ignore for random id generation.
    title: "",
    tags: [],
    category: {
      id: "",
      name: "",
      box_art_url: "",
    },
  });
});

test("既存のテンプレートがある場合、新しいテンプレートは後ろに追加される", async () => {
  const existingTemplate = newTemplate();
  existingTemplate.id = "existing-id";
  existingTemplate.title = "既存のテンプレート";

  const templates: Template[] = [existingTemplate];
  let newTemplates: Template[] = [];
  const setTemplates = (updatedTemplates: Template[]) => {
    newTemplates = updatedTemplates;
  };
  const { getByRole } = render(
    <AddTemplateButton templates={templates} setTemplates={setTemplates} />,
    { wrapper: TestWrapper },
  );

  const button = getByRole("button");
  expect(button).not.toBeNull();

  const user = userEvent.setup();
  await user.click(button);

  expect(newTemplates.length).toBe(2);
  expect(newTemplates[0]).toEqual(existingTemplate);
  expect(newTemplates[1].title).toBe("");
  expect(newTemplates[1].tags).toEqual([]);
});
