import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Tag } from "./component";

test("Tagコンポーネントが子要素を正しくレンダリングする", () => {
  const { getByRole } = render(<Tag>テストタグ</Tag>);

  const tag = getByRole("listitem");
  expect(tag).toHaveTextContent("テストタグ");
});

test("onRemoveプロパティが指定されていない場合、削除ボタンが表示されない", () => {
  const { container } = render(<Tag>テストタグ</Tag>);

  expect(container).not.toHaveTextContent("Remove");
});

test("onRemoveプロパティが指定されている場合、削除ボタンが表示される", () => {
  const onRemove = mock();

  const { getByLabelText } = render(<Tag onRemove={onRemove}>テストタグ</Tag>);

  const closeButton = getByLabelText("remove tag");
  expect(closeButton).not.toBeNull();
});

test("削除ボタンがクリックされたとき、onRemove関数が呼び出される", async () => {
  const onRemove = mock();

  const { getByLabelText } = render(<Tag onRemove={onRemove}>テストタグ</Tag>);

  // 閉じるボタンを取得
  const closeButton = getByLabelText("remove tag");
  expect(closeButton).not.toBeNull();

  const user = userEvent.setup();
  await user.click(closeButton);

  // onRemoveが呼び出されたか確認
  expect(onRemove).toBeCalled();
});
