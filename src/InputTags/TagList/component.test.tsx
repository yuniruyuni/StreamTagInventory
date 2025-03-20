import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagList } from "./component";

test("TagListコンポーネントが空の配列の場合、何も表示しない", () => {
  const tags: string[] = [];
  const onClose = mock();

  const { queryAllByRole } = render(<TagList tags={tags} onClose={onClose} />);

  // リストのアイテムが存在しないことを確認
  const tagElements = queryAllByRole("listitem");
  expect(tagElements?.length).toBe(0);
});

test("TagListコンポーネントがタグを正しくレンダリングする", () => {
  const tags = ["タグ1", "タグ2", "タグ3"];
  const onClose = () => {};

  const { getAllByRole } = render(<TagList tags={tags} onClose={onClose} />);

  // タグの数を確認
  const tagElements = getAllByRole("listitem");
  expect(tagElements?.length).toBe(3);

  // タグのテキストを確認
  expect(tagElements?.[0].textContent).toContain("タグ1");
  expect(tagElements?.[1].textContent).toContain("タグ2");
  expect(tagElements?.[2].textContent).toContain("タグ3");
});

test("タグの閉じるボタンをクリックすると、onClose関数が呼び出される", async () => {
  // モック関数を使用
  const tags = ["タグ1", "タグ2", "タグ3"];
  const onClose = mock();

  // コンポーネントをレンダリング
  const { getAllByRole } = render(<TagList tags={tags} onClose={onClose} />);

  // タグの数を確認
  const tagElements = getAllByRole("listitem");
  expect(tagElements.length).toBe(3);

  const removeButtons = getAllByRole("button");
  expect(removeButtons.length).toBe(3);

  // 2番目のタグの閉じるボタンを取得
  const closeButton = removeButtons[1];
  expect(closeButton).not.toBeNull();

  const user = userEvent.setup();
  await user.click(closeButton);

  expect(onClose).toBeCalledWith(1);
});
