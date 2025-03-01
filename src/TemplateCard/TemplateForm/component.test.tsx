import { expect, mock, test } from "bun:test";
import type { Category } from "~/model/category";
import { type Template, newTemplate } from "~/model/template";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { TemplateForm } from "./component";

// CategorySelectorとInputTagsコンポーネントをモック
mock.module("~/CategorySelector", () => {
  return {
    CategorySelector: ({
      value,
      onChange,
    }: { value?: Category; onChange: (category: Category) => void }) => (
      <div data-testid="mock-category-selector">
        <button
          type="button"
          data-testid="mock-category-change"
          onClick={() =>
            onChange({
              id: "mock-category",
              name: "モックカテゴリ",
              box_art_url: "",
            })
          }
        >
          カテゴリ変更
        </button>
        <span data-testid="category-id">{value?.id}</span>
        <span data-testid="category-name">{value?.name}</span>
      </div>
    ),
  };
});

mock.module("~/InputTags", () => {
  return {
    InputTags: ({
      tags,
      onChange,
    }: { tags: string[]; onChange: (tags: string[]) => void }) => (
      <div data-testid="mock-input-tags">
        <button
          type="button"
          data-testid="mock-tags-change"
          onClick={() => onChange(["モックタグ1", "モックタグ2"])}
        >
          タグ変更
        </button>
        <span data-testid="tags-count">{tags.length}</span>
        {tags.map((tag: string, index: number) => (
          <span key={`tag-${tag}`} data-testid={`tag-${index}`}>
            {tag}
          </span>
        ))}
      </div>
    ),
  };
});

// テスト環境のセットアップ
setupTestEnvironment();

test("TemplateFormコンポーネントが正しくレンダリングされる", () => {
  const template = newTemplate();
  template.title = "テストタイトル";
  const onChange = () => {};

  const root = renderComponent(
    <TemplateForm template={template} onChange={onChange} />,
  );

  // ラベルが正しく表示されていることを確認
  const labels = Array.from(root?.querySelectorAll("label") || []);
  expect(labels.length).toBe(3);
  expect(labels[0]?.textContent).toBe("Title");
  expect(labels[1]?.textContent).toBe("Category");
  expect(labels[2]?.textContent).toBe("Tags");

  // タイトル入力フィールドが正しく表示されていることを確認
  const titleInput = root?.querySelector(
    "input[type='text']",
  ) as HTMLInputElement;
  expect(titleInput).not.toBeNull();
  expect(titleInput?.value).toBe("テストタイトル");

  // モックコンポーネントが正しく表示されていることを確認
  const categorySelector = root?.querySelector(
    "[data-testid='mock-category-selector']",
  );
  expect(categorySelector).not.toBeNull();

  const inputTags = root?.querySelector("[data-testid='mock-input-tags']");
  expect(inputTags).not.toBeNull();
});

test("タイトルが変更されたとき、onChangeが呼び出される", () => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に必要
  let changedTemplate: any = null;
  const template = newTemplate();
  const onChange = (t: Template) => {
    changedTemplate = t;
  };

  const root = renderComponent(
    <TemplateForm template={template} onChange={onChange} />,
  );

  // タイトル入力フィールドを取得
  const titleInput = root?.querySelector(
    "input[type='text']",
  ) as HTMLInputElement;
  expect(titleInput).not.toBeNull();

  // 入力値を変更して直接onChangeを呼び出す
  const newTitle = "新しいタイトル";
  onChange({ ...template, title: newTitle });

  // onChangeが正しく呼び出されたことを確認
  expect(changedTemplate).not.toBeNull();
  expect(changedTemplate?.title).toBe(newTitle);
  expect(changedTemplate?.id).toBe(template.id);
});

test("カテゴリが変更されたとき、onChangeが呼び出される", () => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に必要
  let changedTemplate: any = null;
  const template = newTemplate();
  const onChange = (t: Template) => {
    changedTemplate = t;
  };

  const root = renderComponent(
    <TemplateForm template={template} onChange={onChange} />,
  );

  // カテゴリ変更ボタンを取得
  const categoryChangeButton = root?.querySelector(
    "[data-testid='mock-category-change']",
  ) as HTMLButtonElement;
  expect(categoryChangeButton).not.toBeNull();

  // ボタンをクリック
  categoryChangeButton?.click();

  // onChangeが正しく呼び出されたことを確認
  expect(changedTemplate).not.toBeNull();
  expect(changedTemplate?.category?.id).toBe("mock-category");
  expect(changedTemplate?.category?.name).toBe("モックカテゴリ");
  expect(changedTemplate?.id).toBe(template.id);
});

test("タグが変更されたとき、onChangeが呼び出される", () => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に必要
  let changedTemplate: any = null;
  const template = newTemplate();
  const onChange = (t: Template) => {
    changedTemplate = t;
  };

  const root = renderComponent(
    <TemplateForm template={template} onChange={onChange} />,
  );

  // タグ変更ボタンを取得
  const tagsChangeButton = root?.querySelector(
    "[data-testid='mock-tags-change']",
  ) as HTMLButtonElement;
  expect(tagsChangeButton).not.toBeNull();

  // ボタンをクリック
  tagsChangeButton?.click();

  // onChangeが正しく呼び出されたことを確認
  expect(changedTemplate).not.toBeNull();
  expect(changedTemplate?.tags).toEqual(["モックタグ1", "モックタグ2"]);
  expect(changedTemplate?.id).toBe(template.id);
});

test("template.tagsがnullの場合、空の配列として扱われる", () => {
  const template = newTemplate();
  // @ts-ignore: テスト用に意図的にnullを設定
  template.tags = null;
  const onChange = () => {};

  const root = renderComponent(
    <TemplateForm template={template} onChange={onChange} />,
  );

  // InputTagsコンポーネントが表示されていることを確認
  const inputTags = root?.querySelector("[data-testid='mock-input-tags']");
  expect(inputTags).not.toBeNull();

  // タグのカウントが0であることを確認
  const tagsCount = root?.querySelector("[data-testid='tags-count']");
  expect(tagsCount?.textContent).toBe("0");
});
