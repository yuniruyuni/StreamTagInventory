import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { InputTags } from "./component";

// 初期タグデータ
const initialTags = ["React", "TypeScript", "Tailwind"];

test("InputTagsコンポーネントが初期タグを正しくレンダリングする", () => {
  const onChange = mock();

  const { getByRole, getAllByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
  );

  const tagElements = getAllByRole("listitem");
  expect(tagElements.length).toBe(initialTags.length);

  initialTags.forEach((tag, index) => {
    expect(tagElements[index]).toHaveTextContent(tag);
  });

  // 入力フィールドが存在することを確認
  const input = getByRole("textbox");
  expect(input).not.toBeNull();
});

test("Enterキーでタグを追加できる", async () => {
  const onChange = mock();

  const { getByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
  );

  const user = userEvent.setup();
  await user.click(getByRole("textbox"));
  await user.keyboard("New Tag");
  await user.keyboard("[Enter]");

  expect(onChange).toBeCalledWith([...initialTags, "New Tag"]);
});

test("タグの前後の空白は削除されて登録される", async () => {
  const onChange = mock();

  const { getByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
  );

  const input = getByRole("textbox");
  expect(input).not.toBeNull();

  const user = userEvent.setup();

  await user.click(input);
  await user.keyboard("  Hoge Fuga ");
  await user.keyboard("[Enter]");

  expect(onChange).toBeCalledWith([
    ...initialTags,
    "Hoge Fuga", // trimed spaces.
  ]);
});

test("空の値ではタグが追加されない", async () => {
  const onChange = mock();

  const { getByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
  );

  const input = getByRole("textbox");
  expect(input).not.toBeNull();

  const user = userEvent.setup();

  await user.click(input);
  await user.keyboard("    ");
  await user.keyboard("[Enter]");

  expect(onChange).not.toHaveBeenCalled();
});

test("Backspaceキーで最後のタグを削除できる", async () => {
  const onChange = mock();

  const { getByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
  );

  const user = userEvent.setup();
  await user.click(getByRole("textbox"));
  await user.keyboard("[Backspace]");

  expect(onChange).toBeCalledWith(initialTags.slice(0, -1));
});

test("閉じるボタンをクリックしてタグを削除できる", async () => {
  const onChange = mock();

  const { getAllByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
  );

  const removeButtons = getAllByRole("button", { name: "remove tag" });
  expect(removeButtons.length).toBe(initialTags.length);

  const user = userEvent.setup();
  await user.click(removeButtons[1]);

  expect(onChange).toBeCalledWith([
    ...initialTags.slice(0, 1),
    ...initialTags.slice(2)
  ]);
});

test("フォーカス時にアクティブクラスが適用される", async () => {
  // モックコールバック
  const onChange = mock();

  // コンポーネントをレンダリング
  const { getByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
  );

  const list = getByRole("group");
  expect(list).not.toBeNull();

  // 初期状態ではアクティブクラスがないことを確認
  expect(list).not.toHaveClass("outline-slate-200");

  // 入力フィールドを取得
  const input = getByRole("textbox");
  expect(input).not.toBeNull();

  const user = userEvent.setup();
  await user.click(input); // focus.

  // アクティブクラスが適用されることを確認
  expect(list).toHaveClass("outline-slate-200");
  await user.click(document.body); // unfocus.

  // アクティブクラスが削除されることを確認
  expect(list).not.toHaveClass("outline-slate-200");
});
