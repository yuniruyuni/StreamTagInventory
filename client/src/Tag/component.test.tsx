import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Tag } from "./component";

test("Tagコンポーネントが値を正しくレンダリングする", () => {
  const { getByRole } = render(<Tag value="テストタグ" />);

  const tag = getByRole("listitem");
  expect(tag).toHaveTextContent("テストタグ");
});

test("onRemoveプロパティが指定されていない場合、削除ボタンが表示されない", () => {
  const { queryByLabelText } = render(<Tag value="テストタグ" />);
  expect(queryByLabelText("remove tag")).toBeNull();
});

test("onRemoveプロパティが指定されている場合、削除ボタンが表示される", () => {
  const onRemove = mock();

  const { getByLabelText } = render(
    <Tag value="テストタグ" onRemove={onRemove} />,
  );

  const closeButton = getByLabelText("remove tag");
  expect(closeButton).not.toBeNull();
});

test("削除ボタンがクリックされたとき、onRemove関数が呼び出される", async () => {
  const onRemove = mock();

  const { getByLabelText } = render(
    <Tag value="テストタグ" onRemove={onRemove} />,
  );

  const closeButton = getByLabelText("remove tag");
  expect(closeButton).not.toBeNull();

  const user = userEvent.setup();
  await user.click(closeButton);

  expect(onRemove).toBeCalled();
});

test("onEditが指定されていない場合、編集用のボタンは存在しない", () => {
  const { queryByRole } = render(<Tag value="テストタグ" />);
  expect(queryByRole("button", { name: /edit tag/ })).toBeNull();
});

test("onEditが指定されている場合、タグのボタンが表示される", () => {
  const onEdit = mock();
  const { getByRole } = render(<Tag value="テストタグ" onEdit={onEdit} />);
  const editButton = getByRole("button", { name: "edit tag テストタグ" });
  expect(editButton).not.toBeNull();
});

test("タグをクリックすると編集モードになり入力が現れる", async () => {
  const onEdit = mock();
  const { getByRole } = render(<Tag value="テストタグ" onEdit={onEdit} />);

  const user = userEvent.setup();
  await user.click(getByRole("button", { name: "edit tag テストタグ" }));

  const editInput = getByRole("textbox", { name: "edit tag" });
  expect(editInput).not.toBeNull();
  expect(editInput).toHaveValue("テストタグ");
});

test("編集モードで値を変更してEnterを押すとonEditが呼ばれる", async () => {
  const onEdit = mock();
  const { getByRole } = render(<Tag value="テストタグ" onEdit={onEdit} />);

  const user = userEvent.setup();
  await user.click(getByRole("button", { name: "edit tag テストタグ" }));

  const editInput = getByRole("textbox", { name: "edit tag" });
  await user.clear(editInput);
  await user.type(editInput, "新しいタグ");
  await user.keyboard("[Enter]");

  expect(onEdit).toBeCalledWith("新しいタグ");
});

test("編集結果が元の値と同じ場合はonEditが呼ばれない", async () => {
  const onEdit = mock();
  const { getByRole } = render(<Tag value="テストタグ" onEdit={onEdit} />);

  const user = userEvent.setup();
  await user.click(getByRole("button", { name: "edit tag テストタグ" }));
  await user.keyboard("[Enter]");

  expect(onEdit).not.toBeCalled();
});

test("編集モードでEscapeを押すと編集がキャンセルされる", async () => {
  const onEdit = mock();
  const { getByRole, queryByRole } = render(
    <Tag value="テストタグ" onEdit={onEdit} />,
  );

  const user = userEvent.setup();
  await user.click(getByRole("button", { name: "edit tag テストタグ" }));

  const editInput = getByRole("textbox", { name: "edit tag" });
  await user.clear(editInput);
  await user.type(editInput, "新しいタグ");
  await user.keyboard("[Escape]");

  expect(onEdit).not.toBeCalled();
  expect(queryByRole("textbox", { name: "edit tag" })).toBeNull();
});

test("編集モードで空白のみの値を確定した場合はonEditが呼ばれない", async () => {
  const onEdit = mock();
  const { getByRole } = render(<Tag value="テストタグ" onEdit={onEdit} />);

  const user = userEvent.setup();
  await user.click(getByRole("button", { name: "edit tag テストタグ" }));

  const editInput = getByRole("textbox", { name: "edit tag" });
  await user.clear(editInput);
  await user.type(editInput, "   ");
  await user.keyboard("[Enter]");

  expect(onEdit).not.toBeCalled();
});
