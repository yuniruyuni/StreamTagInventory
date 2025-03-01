import { expect, test } from "bun:test";
import { type Template, newTemplate } from "~/model/template";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { AddTemplateButton } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("AddTemplateButtonコンポーネントが正しくレンダリングされる", () => {
  const templates: Template[] = [];
  const setTemplates = () => {};

  const root = renderComponent(
    <AddTemplateButton templates={templates} setTemplates={setTemplates} />,
  );

  // ボタン要素が存在することを確認
  const button = root?.querySelector("button");
  expect(button).not.toBeNull();
  expect(button?.textContent).toBe("Add");
  expect(button?.className).toContain("btn-primary");
});

test("ボタンをクリックすると、新しいテンプレートが追加される", () => {
  const templates: Template[] = [];
  let newTemplates: Template[] = [];
  const setTemplates = (updatedTemplates: Template[]) => {
    newTemplates = updatedTemplates;
  };

  const root = renderComponent(
    <AddTemplateButton templates={templates} setTemplates={setTemplates} />,
  );

  // ボタン要素を取得
  const button = root?.querySelector("button");
  expect(button).not.toBeNull();

  // ボタンをクリック
  button?.click();

  // setTemplatesが呼び出され、新しいテンプレートが追加されたことを確認
  expect(newTemplates.length).toBe(1);
  expect(newTemplates[0].title).toBe("");
  expect(newTemplates[0].tags).toEqual([]);
  expect(newTemplates[0].category.id).toBe("");
  expect(newTemplates[0].category.name).toBe("");
  expect(newTemplates[0].category.box_art_url).toBe("");
});

test("既存のテンプレートがある場合、新しいテンプレートが追加される", () => {
  const existingTemplate = newTemplate();
  existingTemplate.id = "existing-id";
  existingTemplate.title = "既存のテンプレート";

  const templates: Template[] = [existingTemplate];
  let newTemplates: Template[] = [];
  const setTemplates = (updatedTemplates: Template[]) => {
    newTemplates = updatedTemplates;
  };

  const root = renderComponent(
    <AddTemplateButton templates={templates} setTemplates={setTemplates} />,
  );

  // ボタン要素を取得
  const button = root?.querySelector("button");
  expect(button).not.toBeNull();

  // ボタンをクリック
  button?.click();

  // setTemplatesが呼び出され、新しいテンプレートが追加されたことを確認
  expect(newTemplates.length).toBe(2);
  expect(newTemplates[0]).toEqual(existingTemplate);
  expect(newTemplates[1].title).toBe("");
  expect(newTemplates[1].tags).toEqual([]);
});
