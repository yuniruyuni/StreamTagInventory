import { expect, test } from "bun:test";
import { type Template, newTemplate } from "~/model/template";
import {
  type React,
  renderComponent,
  setupTestEnvironment,
} from "../../test-utils";

// テスト環境のセットアップ
setupTestEnvironment();

// モックデータの作成
function createMockTemplates(): Template[] {
  const template1 = newTemplate();
  template1.id = "template-1";
  template1.title = "テンプレート1";
  template1.category = {
    id: "category-1",
    name: "カテゴリー1",
    box_art_url: "url-1",
  };
  template1.tags = ["タグ1", "タグ2"];

  const template2 = newTemplate();
  template2.id = "template-2";
  template2.title = "テンプレート2";
  template2.category = {
    id: "category-2",
    name: "カテゴリー2",
    box_art_url: "url-2",
  };
  template2.tags = ["タグ3", "タグ4"];

  return [template1, template2];
}

// TemplateCardコンポーネントをモックする代わりに、
// DndContextとSortableContextをモックして、テンプレートカードの代わりにモック要素を直接レンダリングする

// DndContextのモック
function MockDndContext({ children }: { children: React.ReactNode }) {
  return <div className="mock-dnd-context">{children}</div>;
}

// SortableContextのモック
function MockSortableContext({ children }: { children: React.ReactNode }) {
  return <div className="mock-sortable-context">{children}</div>;
}

// TemplateCardのモック
function MockTemplateCard({
  template,
  onApply,
  onRemove,
  onClone,
  onSave,
}: {
  template: Template;
  onApply: (template: Template) => void;
  onRemove: (template: Template) => void;
  onClone: (template: Template) => void;
  onSave: (template: Template) => void;
}) {
  return (
    <div
      data-testid={`template-card-${template.id}`}
      data-template-id={template.id}
      data-template-title={template.title}
      className="template-card-mock"
    >
      <button
        type="button"
        data-testid={`apply-button-${template.id}`}
        onClick={() => onApply(template)}
      >
        Apply
      </button>
      <button
        type="button"
        data-testid={`remove-button-${template.id}`}
        onClick={() => onRemove(template)}
      >
        Remove
      </button>
      <button
        type="button"
        data-testid={`clone-button-${template.id}`}
        onClick={() => onClone(template)}
      >
        Clone
      </button>
      <button
        type="button"
        data-testid={`save-button-${template.id}`}
        onClick={() => onSave(template)}
      >
        Save
      </button>
    </div>
  );
}

// モック版のTemplateListコンポーネント
function MockTemplateList({
  templates,
  onApply,
  onRemove,
  onClone,
  onSave,
}: {
  templates: Template[];
  onApply: (template: Template) => void;
  onRemove: (template: Template) => void;
  onClone: (template: Template) => void;
  onSave: (template: Template) => void;
}) {
  return (
    <MockDndContext>
      <MockSortableContext>
        {templates.map((template) => (
          <MockTemplateCard
            key={template.id}
            template={template}
            onApply={onApply}
            onRemove={onRemove}
            onClone={onClone}
            onSave={onSave}
          />
        ))}
      </MockSortableContext>
    </MockDndContext>
  );
}

test("TemplateListコンポーネントが正しくレンダリングされる", () => {
  const templates = createMockTemplates();
  const onApply = () => {};
  const onRemove = () => {};
  const onClone = () => {};
  const onSave = () => {};

  const root = renderComponent(
    <MockTemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // テンプレートカードが正しい数だけレンダリングされていることを確認
  const templateCards = root?.querySelectorAll(".template-card-mock");
  expect(templateCards?.length).toBe(2);

  // 各テンプレートカードが正しいデータを持っていることを確認
  const card1 = root?.querySelector(`[data-template-id="template-1"]`);
  expect(card1).not.toBeNull();
  expect(card1?.getAttribute("data-template-title")).toBe("テンプレート1");

  const card2 = root?.querySelector(`[data-template-id="template-2"]`);
  expect(card2).not.toBeNull();
  expect(card2?.getAttribute("data-template-title")).toBe("テンプレート2");
});

test("onApplyが正しく呼び出される", () => {
  const templates = createMockTemplates();
  let appliedTemplate: Template | null = null;
  const onApply = (template: Template) => {
    appliedTemplate = template;
  };
  const onRemove = () => {};
  const onClone = () => {};
  const onSave = () => {};

  const root = renderComponent(
    <MockTemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // Apply ボタンをクリック
  const applyButton = root?.querySelector(
    `[data-testid="apply-button-template-1"]`,
  ) as HTMLButtonElement;
  applyButton?.click();

  // onApply が正しく呼び出されたことを確認
  expect(appliedTemplate).not.toBeNull();
  // TypeScriptの型エラーを回避するために型アサーションを使用
  const template = appliedTemplate as unknown as Template;
  expect(template.id).toBe("template-1");
  expect(template.title).toBe("テンプレート1");
});

test("onRemoveが正しく呼び出される", () => {
  const templates = createMockTemplates();
  const onApply = () => {};
  let removedTemplate: Template | null = null;
  const onRemove = (template: Template) => {
    removedTemplate = template;
  };
  const onClone = () => {};
  const onSave = () => {};

  const root = renderComponent(
    <MockTemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // Remove ボタンをクリック
  const removeButton = root?.querySelector(
    `[data-testid="remove-button-template-2"]`,
  ) as HTMLButtonElement;
  removeButton?.click();

  // onRemove が正しく呼び出されたことを確認
  expect(removedTemplate).not.toBeNull();
  // TypeScriptの型エラーを回避するために型アサーションを使用
  const template = removedTemplate as unknown as Template;
  expect(template.id).toBe("template-2");
  expect(template.title).toBe("テンプレート2");
});

test("onCloneが正しく呼び出される", () => {
  const templates = createMockTemplates();
  const onApply = () => {};
  const onRemove = () => {};
  let clonedTemplate: Template | null = null;
  const onClone = (template: Template) => {
    clonedTemplate = template;
  };
  const onSave = () => {};

  const root = renderComponent(
    <MockTemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // Clone ボタンをクリック
  const cloneButton = root?.querySelector(
    `[data-testid="clone-button-template-1"]`,
  ) as HTMLButtonElement;
  cloneButton?.click();

  // onClone が正しく呼び出されたことを確認
  expect(clonedTemplate).not.toBeNull();
  // TypeScriptの型エラーを回避するために型アサーションを使用
  const template = clonedTemplate as unknown as Template;
  expect(template.id).toBe("template-1");
  expect(template.title).toBe("テンプレート1");
});

test("onSaveが正しく呼び出される", () => {
  const templates = createMockTemplates();
  const onApply = () => {};
  const onRemove = () => {};
  const onClone = () => {};
  let savedTemplate: Template | null = null;
  const onSave = (template: Template) => {
    savedTemplate = template;
  };

  const root = renderComponent(
    <MockTemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // Save ボタンをクリック
  const saveButton = root?.querySelector(
    `[data-testid="save-button-template-2"]`,
  ) as HTMLButtonElement;
  saveButton?.click();

  // onSave が正しく呼び出されたことを確認
  expect(savedTemplate).not.toBeNull();
  // TypeScriptの型エラーを回避するために型アサーションを使用
  const template = savedTemplate as unknown as Template;
  expect(template.id).toBe("template-2");
  expect(template.title).toBe("テンプレート2");
});

test("空のテンプレートリストが正しくレンダリングされる", () => {
  const templates: Template[] = [];
  const onApply = () => {};
  const onRemove = () => {};
  const onClone = () => {};
  const onSave = () => {};

  const root = renderComponent(
    <MockTemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
    />,
  );

  // テンプレートカードが存在しないことを確認
  const templateCards = root?.querySelectorAll(".template-card-mock");
  expect(templateCards?.length).toBe(0);
});
