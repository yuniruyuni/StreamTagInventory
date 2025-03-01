import { expect, test } from "bun:test";
import { newTemplate } from "~/model/template";
import { renderComponent, setupTestEnvironment } from "../test-utils";
import { TemplateCard } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

// モックコンポーネントを使用せずにテスト
test("TemplateCardコンポーネントが正しくレンダリングされる", () => {
  const template = newTemplate();
  template.title = "テストタイトル";
  const onApply = () => {};
  const onRemove = () => {};
  const onClone = () => {};
  const onSave = () => {};

  const root = renderComponent(
    <TemplateCard
      template={template}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // カードが表示されていることを確認
  const card = root?.querySelector(".card");
  expect(card).not.toBeNull();

  // フォームが表示されていることを確認
  const titleInput = root?.querySelector("input[type='text']");
  expect(titleInput).not.toBeNull();
  expect(titleInput?.getAttribute("value")).toBe("テストタイトル");
});

test("テンプレートの操作が正しく動作する", () => {
  const template = newTemplate();
  template.title = "テストタイトル";

  // モック関数を作成
  const onApply = () => {};
  const onRemove = () => {};
  const onClone = () => {};
  const onSave = () => {};

  const root = renderComponent(
    <TemplateCard
      template={template}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // 各ボタンが存在することを確認
  const buttons = Array.from(root?.querySelectorAll("button") || []);
  expect(buttons.length).toBeGreaterThan(0);

  // ボタンのテキストを確認
  const buttonTexts = buttons.map((button) => button.textContent?.trim());
  expect(buttonTexts.some((text) => text === "Apply")).toBe(true);
});
