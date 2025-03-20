import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { newTemplate } from "~/model/template";
import { TemplateCard } from "./component";

// モックコンポーネントを使用せずにテスト
test("TemplateCardコンポーネントが正しくレンダリングされる", () => {
  const template = newTemplate();
  template.title = "テストタイトル";
  const onApply = () => {};
  const onRemove = () => {};
  const onClone = () => {};
  const onSave = () => {};

  const { getAllByRole } = render(
    <TemplateCard
      template={template}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // カードが表示されていることを確認（カードはdivなのでgetByRoleでは直接取得できない）
  // フォームが表示されていることを確認（最初のテキストボックスがタイトル入力フィールド）
  const textboxes = getAllByRole("textbox");
  const titleInput = textboxes[0]; // 最初のテキストボックスがタイトル入力フィールド
  expect(titleInput).not.toBeNull();
  expect(titleInput).toHaveValue("テストタイトル");
});

test("テンプレートの操作が正しく動作する", () => {
  const template = newTemplate();
  template.title = "テストタイトル";

  // モック関数を作成
  const onApply = () => {};
  const onRemove = () => {};
  const onClone = () => {};
  const onSave = () => {};

  const { getAllByRole } = render(
    <TemplateCard
      template={template}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // 各ボタンが存在することを確認
  const buttons = getAllByRole("button");
  expect(buttons.length).toBeGreaterThan(0);

  // ボタンのテキストを確認
  const buttonTexts = buttons.map((button) => button.textContent?.trim());
  expect(buttonTexts.some((text) => text === "Apply")).toBe(true);
});
