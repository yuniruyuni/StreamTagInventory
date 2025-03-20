import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { type Template, newTemplate } from "~/model/template";
import { AddTemplateButton } from "./component";

test("AddTemplateButtonコンポーネントが正しくレンダリングされる", () => {
  const templates: Template[] = [];
  const setTemplates = () => {};

  const { getByRole } = render(
    <AddTemplateButton templates={templates} setTemplates={setTemplates} />,
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
