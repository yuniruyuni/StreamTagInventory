import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { newTemplate } from "~/model/template";
import { I18nWrapper } from "~/test-utils";
import { TemplateCard } from "./component";

// モックコンポーネントを使用せずにテスト
test("TemplateCardコンポーネントが正しくレンダリングされる", () => {
  const template = newTemplate();
  template.title = "テストタイトル";
  const onApply = () => {};
  const onRemove = () => {};
  const onClone = () => {};
  const onSave = () => {};
  const onPostToX = () => {};

  const { getAllByRole } = render(
    <I18nWrapper>
      <TemplateCard
        template={template}
        onApply={onApply}
        onRemove={onRemove}
        onClone={onClone}
        onSave={onSave}
        onPostToX={onPostToX}
      />
    </I18nWrapper>,
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
  const onPostToX = () => {};

  const { getByLabelText } = render(
    <I18nWrapper>
      <TemplateCard
        template={template}
        onApply={onApply}
        onRemove={onRemove}
        onClone={onClone}
        onSave={onSave}
        onPostToX={onPostToX}
      />
    </I18nWrapper>,
  );

  // aria-labelを使って言語に依存せずにボタンを検出
  const applyButton = getByLabelText("apply template");
  expect(applyButton).toBeTruthy();
  expect(applyButton.tagName).toBe("BUTTON");
});
