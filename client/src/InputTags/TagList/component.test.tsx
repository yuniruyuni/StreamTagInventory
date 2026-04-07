import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagList } from "./component";

test("TagListコンポーネントが空の配列の場合、何も表示しない", () => {
  const tags: string[] = [];
  const onRemove = mock();
  const onEdit = mock();

  const { queryAllByRole } = render(
    <TagList tags={tags} onRemove={onRemove} onEdit={onEdit} />,
  );

  // リストのアイテムが存在しないことを確認
  const tagElements = queryAllByRole("listitem");
  expect(tagElements?.length).toBe(0);
});

test("TagListコンポーネントがタグを正しくレンダリングする", () => {
  const tags = ["タグ1", "タグ2", "タグ3"];
  const onRemove = () => {};
  const onEdit = () => {};

  const { getAllByRole } = render(
    <TagList tags={tags} onRemove={onRemove} onEdit={onEdit} />,
  );

  // タグの数を確認
  const tagElements = getAllByRole("listitem");
  expect(tagElements.length).toBe(3);

  // タグのテキストを確認
  expect(tagElements[0]).toHaveTextContent("タグ1");
  expect(tagElements[1]).toHaveTextContent("タグ2");
  expect(tagElements[2]).toHaveTextContent("タグ3");
});

test("タグの閉じるボタンをクリックすると、onRemove関数が呼び出される", async () => {
  // モック関数を使用
  const tags = ["タグ1", "タグ2", "タグ3"];
  const onRemove = mock();
  const onEdit = mock();

  // コンポーネントをレンダリング
  const { getAllByRole, getAllByLabelText } = render(
    <TagList tags={tags} onRemove={onRemove} onEdit={onEdit} />,
  );

  // タグの数を確認
  const tagElements = getAllByRole("listitem");
  expect(tagElements.length).toBe(3);

  const removeButtons = getAllByLabelText("remove tag");
  expect(removeButtons.length).toBe(3);

  // 2番目のタグの閉じるボタンを取得
  const removeButton = removeButtons[1];
  expect(removeButton).not.toBeNull();

  const user = userEvent.setup();
  await user.click(removeButton);

  expect(onRemove).toBeCalledWith(1);
});
