import { beforeAll, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "~/i18n/config";
import { DEFAULT_POST_TEMPLATE } from "~/utils/postTemplate";
import { PostTemplateEditor } from "./component";

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

test("open=false の場合は dialog が閉じている", () => {
  const { container } = render(
    <PostTemplateEditor
      open={false}
      postTemplate={DEFAULT_POST_TEMPLATE}
      onSave={() => {}}
      onClose={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  const dialog = container.querySelector("dialog");
  expect(dialog).not.toBeNull();
  expect(dialog?.open).toBe(false);
});

test("open=true の場合にテンプレートエディタが表示される", () => {
  const { getByLabelText, getByText } = render(
    <PostTemplateEditor
      open={true}
      postTemplate={DEFAULT_POST_TEMPLATE}
      onSave={() => {}}
      onClose={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  // Textarea が表示される
  const textarea = getByLabelText("Post Template");
  expect(textarea).not.toBeNull();

  // プレビューセクションが表示される
  expect(getByText("Preview")).not.toBeNull();

  // 保存・キャンセルボタンが表示される
  expect(getByText("Save")).not.toBeNull();
  expect(getByText("Cancel")).not.toBeNull();
  expect(getByText("Reset to Default")).not.toBeNull();
});

test("プレビューにサンプルデータが表示される", () => {
  const { getByText } = render(
    <PostTemplateEditor
      open={true}
      postTemplate="{title} - {category}"
      onSave={() => {}}
      onClose={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  expect(getByText("Sample Stream Title - Apex Legends")).not.toBeNull();
});
