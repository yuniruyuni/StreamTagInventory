import { expect, test } from "bun:test";
import { type Template, newTemplate } from "~/model/template";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { TemplateActions } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

// モックテンプレートの作成
function createMockTemplate(valid = true): Template {
  const template = newTemplate();
  template.id = "test-id";
  template.title = valid ? "テストタイトル" : "";
  template.category = {
    id: valid ? "category-id" : "",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  template.tags = valid ? ["タグ1", "タグ2"] : [];
  return template;
}

// 変更がない状態のテスト
test("変更がない状態で正しくレンダリングされる", () => {
  const template = createMockTemplate();
  const changed = false;
  const onRevert = () => {};
  const onSave = () => {};
  const onClone = () => {};
  const onRemove = () => {};
  const onApply = () => {};

  const root = renderComponent(
    <TemplateActions
      template={template}
      changed={changed}
      onRevert={onRevert}
      onSave={onSave}
      onClone={onClone}
      onRemove={onRemove}
      onApply={onApply}
    />,
  );

  // ボタンが正しく表示されていることを確認
  const buttons = root?.querySelectorAll("button");
  expect(buttons?.length).toBe(3);

  // Clone, Remove, Applyボタンが表示されていることを確認
  const buttonTexts = Array.from(buttons || []).map((button) =>
    button.textContent?.trim(),
  );
  expect(buttonTexts).toContain("Clone");
  expect(buttonTexts).toContain("Remove");
  expect(buttonTexts).toContain("Apply");

  // Revertボタンと変更時のSaveボタンが表示されていないことを確認
  expect(buttonTexts).not.toContain("Revert");
  expect(buttonTexts).not.toContain("Save");
});

// 変更がある状態のテスト
test("変更がある状態で正しくレンダリングされる", () => {
  const template = createMockTemplate();
  const changed = true;
  const onRevert = () => {};
  const onSave = () => {};
  const onClone = () => {};
  const onRemove = () => {};
  const onApply = () => {};

  const root = renderComponent(
    <TemplateActions
      template={template}
      changed={changed}
      onRevert={onRevert}
      onSave={onSave}
      onClone={onClone}
      onRemove={onRemove}
      onApply={onApply}
    />,
  );

  // ボタンが正しく表示されていることを確認
  const buttons = root?.querySelectorAll("button");
  expect(buttons?.length).toBe(2);

  // RevertとSaveボタンが表示されていることを確認
  const buttonTexts = Array.from(buttons || []).map((button) =>
    button.textContent?.trim(),
  );
  expect(buttonTexts).toContain("Revert");
  expect(buttonTexts).toContain("Save");

  // Clone, Remove, Applyボタンが表示されていないことを確認
  expect(buttonTexts).not.toContain("Clone");
  expect(buttonTexts).not.toContain("Remove");
  expect(buttonTexts).not.toContain("Apply");
});

// 無効なテンプレートのテスト
test("無効なテンプレートの場合、Applyボタンが無効化される", () => {
  const template = createMockTemplate(false);
  const changed = false;
  const onRevert = () => {};
  const onSave = () => {};
  const onClone = () => {};
  const onRemove = () => {};
  const onApply = () => {};

  const root = renderComponent(
    <TemplateActions
      template={template}
      changed={changed}
      onRevert={onRevert}
      onSave={onSave}
      onClone={onClone}
      onRemove={onRemove}
      onApply={onApply}
    />,
  );

  // Applyボタンが無効化されていることを確認
  const applyButton = Array.from(root?.querySelectorAll("button") || []).find(
    (button) => button.textContent?.trim() === "Apply",
  );
  expect(applyButton).not.toBeNull();
  expect(applyButton?.className).toContain("btn-disabled");
});

// イベントハンドラのテスト
test("RevertボタンをクリックするとonRevertが呼び出される", () => {
  let revertCalled = false;
  const template = createMockTemplate();
  const changed = true;
  const onRevert = () => {
    revertCalled = true;
  };
  const onSave = () => {};
  const onClone = () => {};
  const onRemove = () => {};
  const onApply = () => {};

  const root = renderComponent(
    <TemplateActions
      template={template}
      changed={changed}
      onRevert={onRevert}
      onSave={onSave}
      onClone={onClone}
      onRemove={onRemove}
      onApply={onApply}
    />,
  );

  // Revertボタンをクリック
  const revertButton = Array.from(root?.querySelectorAll("button") || []).find(
    (button) => button.textContent?.trim() === "Revert",
  );
  revertButton?.click();

  // onRevertが呼び出されたことを確認
  expect(revertCalled).toBe(true);
});

test("SaveボタンをクリックするとonSaveが呼び出される", () => {
  let savedTemplate: Template | undefined;
  const template = createMockTemplate();
  const changed = true;
  const onRevert = () => {};
  const onSave = (t: Template) => {
    savedTemplate = t;
  };
  const onClone = () => {};
  const onRemove = () => {};
  const onApply = () => {};

  const root = renderComponent(
    <TemplateActions
      template={template}
      changed={changed}
      onRevert={onRevert}
      onSave={onSave}
      onClone={onClone}
      onRemove={onRemove}
      onApply={onApply}
    />,
  );

  // Saveボタンをクリック
  const saveButton = Array.from(root?.querySelectorAll("button") || []).find(
    (button) => button.textContent?.trim() === "Save",
  );
  saveButton?.click();

  // onSaveが正しいテンプレートで呼び出されたことを確認
  expect(savedTemplate).toBe(template);
});

test("CloneボタンをクリックするとonCloneが呼び出される", () => {
  let clonedTemplate: Template | undefined;
  const template = createMockTemplate();
  const changed = false;
  const onRevert = () => {};
  const onSave = () => {};
  const onClone = (t: Template) => {
    clonedTemplate = t;
  };
  const onRemove = () => {};
  const onApply = () => {};

  const root = renderComponent(
    <TemplateActions
      template={template}
      changed={changed}
      onRevert={onRevert}
      onSave={onSave}
      onClone={onClone}
      onRemove={onRemove}
      onApply={onApply}
    />,
  );

  // Cloneボタンをクリック
  const cloneButton = Array.from(root?.querySelectorAll("button") || []).find(
    (button) => button.textContent?.trim() === "Clone",
  );
  cloneButton?.click();

  // onCloneが正しいテンプレートで呼び出されたことを確認
  expect(clonedTemplate).toBe(template);
});

test("RemoveボタンをクリックするとonRemoveが呼び出される", () => {
  let removedTemplate: Template | undefined;
  const template = createMockTemplate();
  const changed = false;
  const onRevert = () => {};
  const onSave = () => {};
  const onClone = () => {};
  const onRemove = (t: Template) => {
    removedTemplate = t;
  };
  const onApply = () => {};

  const root = renderComponent(
    <TemplateActions
      template={template}
      changed={changed}
      onRevert={onRevert}
      onSave={onSave}
      onClone={onClone}
      onRemove={onRemove}
      onApply={onApply}
    />,
  );

  // Removeボタンをクリック
  const removeButton = Array.from(root?.querySelectorAll("button") || []).find(
    (button) => button.textContent?.trim() === "Remove",
  );
  removeButton?.click();

  // onRemoveが正しいテンプレートで呼び出されたことを確認
  expect(removedTemplate).toBe(template);
});

test("ApplyボタンをクリックするとonApplyが呼び出される", () => {
  let appliedTemplate: Template | undefined;
  const template = createMockTemplate();
  const changed = false;
  const onRevert = () => {};
  const onSave = () => {};
  const onClone = () => {};
  const onRemove = () => {};
  const onApply = (t: Template) => {
    appliedTemplate = t;
  };

  const root = renderComponent(
    <TemplateActions
      template={template}
      changed={changed}
      onRevert={onRevert}
      onSave={onSave}
      onClone={onClone}
      onRemove={onRemove}
      onApply={onApply}
    />,
  );

  // Applyボタンをクリック
  const applyButton = Array.from(root?.querySelectorAll("button") || []).find(
    (button) => button.textContent?.trim() === "Apply",
  );
  applyButton?.click();

  // onApplyが正しいテンプレートで呼び出されたことを確認
  expect(appliedTemplate).toBe(template);
});
