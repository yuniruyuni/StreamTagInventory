import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Tag } from "./component";

test("Tagコンポーネントが子要素を正しくレンダリングする", () => {
  const { getByRole } = render(<Tag>テストタグ</Tag>);

  const tag = getByRole("listitem");
  expect(tag).toHaveTextContent("テストタグ");
});

test("onCloseプロパティが指定されていない場合、削除ボタンが表示されない", () => {
  const { container } = render(<Tag>テストタグ</Tag>);

  expect(container).not.toHaveTextContent("Remove");
});

test("onCloseプロパティが指定されている場合、削除ボタンが表示される", () => {
  const onClose = mock();

  const { getByLabelText } = render(<Tag onClose={onClose}>テストタグ</Tag>);

  const closeButton = getByLabelText("Remove");
  expect(closeButton).not.toBeNull();
});

test("削除ボタンがクリックされたとき、onClose関数が呼び出される", async () => {
  const onClose = mock();

  const { getByLabelText } = render(<Tag onClose={onClose}>テストタグ</Tag>);

  // 閉じるボタンを取得
  const closeButton = getByLabelText("Remove");
  expect(closeButton).not.toBeNull();

  const user = userEvent.setup();
  await user.click(closeButton);

  // onCloseが呼び出されたか確認
  expect(onClose).toBeCalled();
});
