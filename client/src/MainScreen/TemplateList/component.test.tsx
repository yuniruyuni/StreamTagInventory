import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Template } from "~/model/template";
import { TemplateList } from "./component";

const mockTemplates: Template[] = [
  {
    id: "template-1",
    title: "テンプレート1",
    category: {
      id: "category-1",
      name: "カテゴリー1",
      box_art_url: "url-1",
    },
    tags: ["タグ1", "タグ2"],
  },
  {
    id: "template-2",
    title: "テンプレート2",
    category: {
      id: "category-2",
      name: "カテゴリー2",
      box_art_url: "url-2",
    },
    tags: ["タグ3", "タグ4"],
  },
];

test("TemplateListコンポーネントが正しくレンダリングされる", () => {
  const templates = mockTemplates;
  const onApply = mock();
  const onRemove = mock();
  const onClone = mock();
  const onSave = mock();
  const onMove = mock();
  const { getAllByTestId, getByTestId } = render(
    <TemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
      onMove={onMove}
    />,
  );

  // テンプレートカードが正しい数だけレンダリングされていることを確認
  const templateCards = getAllByTestId(/template-card-.*/);
  expect(templateCards.length).toBe(2);

  // 各テンプレートカードが正しいデータを持っていることを確認
  const card1 = getByTestId("template-card-template-1");
  expect(card1).not.toBeNull();

  const card2 = getByTestId("template-card-template-2");
  expect(card2).not.toBeNull();
});

test("onApplyが正しく呼び出される", async () => {
  const templates = mockTemplates;
  const onApply = mock();
  const onRemove = mock();
  const onClone = mock();
  const onSave = mock();
  const onMove = mock();
  const { getAllByRole } = render(
    <TemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
      onMove={onMove}
    />,
  );

  const user = userEvent.setup();
  const applyButtons = getAllByRole("button", { name: "apply template" });
  await user.click(applyButtons[1]);

  // onApply が正しく呼び出されたことだけを確認
  // idの生成が毎回異なる乱数によっている関係で
  // 生成されるオブジェクトを設定できないという事情による。
  // idだけ無視する方法があるならそのほうが望ましい
  expect(onApply).toBeCalled();
  expect(onApply.mock.calls[0][0]).toMatchObject({
    title: "テンプレート2",
    tags: ["タグ3", "タグ4"],
    category: {
      id: "category-2",
      name: "カテゴリー2",
      box_art_url: "url-2",
    },
  });
});

test("onRemoveが正しく呼び出される", async () => {
  const templates = mockTemplates;
  const onApply = mock();
  const onRemove = mock();
  const onClone = mock();
  const onSave = mock();
  const onMove = mock();

  const { getAllByRole } = render(
    <TemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
      onMove={onMove}
    />,
  );

  // Remove ボタンをクリック
  const user = userEvent.setup();
  const applyButtons = getAllByRole("button", { name: "remove template" });
  await user.click(applyButtons[1]);

  // onRemove が正しく呼び出されたことを確認
  expect(onRemove).toBeCalled();
  expect(onRemove.mock.calls[0][0]).toMatchObject({
    title: "テンプレート2",
    tags: ["タグ3", "タグ4"],
    category: {
      id: "category-2",
      name: "カテゴリー2",
      box_art_url: "url-2",
    },
  });
});

test("onCloneが正しく呼び出される", async () => {
  const templates = mockTemplates;
  const onApply = mock();
  const onRemove = mock();
  const onClone = mock();
  const onSave = mock();
  const onMove = mock();

  const { getAllByRole } = render(
    <TemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
      onMove={onMove}
    />,
  );

  const user = userEvent.setup();
  const cloneButtons = getAllByRole("button", { name: "clone template" });
  await user.click(cloneButtons[1]);

  // onClone が正しく呼び出されたことを確認
  expect(onClone).toBeCalled();
  expect(onClone.mock.calls[0][0]).toMatchObject({
    title: "テンプレート2",
    tags: ["タグ3", "タグ4"],
    category: {
      id: "category-2",
      name: "カテゴリー2",
      box_art_url: "url-2",
    },
  });
});

test("onSaveが正しく呼び出される", async () => {
  const templates = mockTemplates;
  const onApply = mock();
  const onRemove = mock();
  const onClone = mock();
  const onSave = mock();
  const onMove = mock();

  const { getByRole, getByDisplayValue } = render(
    <TemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
      onMove={onMove}
    />,
  );

  const user = userEvent.setup();
  const titleInput = getByDisplayValue(templates[1].title);
  await user.click(titleInput);
  await user.keyboard("change");
  await user.click(document.body);

  const saveButton = getByRole("button", { name: "save template" });
  await user.click(saveButton);

  expect(onSave).toBeCalled();
  expect(onSave.mock.calls[0][0]).toMatchObject({
    title: "テンプレート2change",
    tags: ["タグ3", "タグ4"],
    category: {
      id: "category-2",
      name: "カテゴリー2",
      box_art_url: "url-2",
    },
  });
});

test("空のテンプレートリストが正しくレンダリングされる", () => {
  const templates: Template[] = [];
  const onApply = mock();
  const onRemove = mock();
  const onClone = mock();
  const onSave = mock();
  const onMove = mock();

  const { queryAllByTestId } = render(
    <TemplateList
      templates={templates}
      onApply={onApply}
      onRemove={onRemove}
      onClone={onClone}
      onSave={onSave}
      onMove={onMove}
    />,
  );

  // テンプレートカードが存在しないことを確認
  const templateCards = queryAllByTestId(/^template-card-/);
  expect(templateCards.length).toBe(0);
});
