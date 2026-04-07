import { beforeAll, expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "~/i18n/config";
import { InputTags, MAX_TAGS } from "./component";

// 初期タグデータ
const initialTags = ["React", "TypeScript", "Tailwind"];

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

test("InputTagsコンポーネントが初期タグを正しくレンダリングする", () => {
  const onChange = mock();

  const { getByRole, getAllByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
    { wrapper },
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
    { wrapper },
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
    { wrapper },
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
    { wrapper },
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
    { wrapper },
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
    { wrapper },
  );

  const removeButtons = getAllByRole("button", { name: "remove tag" });
  expect(removeButtons.length).toBe(initialTags.length);

  const user = userEvent.setup();
  await user.click(removeButtons[1]);

  expect(onChange).toBeCalledWith([
    ...initialTags.slice(0, 1),
    ...initialTags.slice(2),
  ]);
});

test("フォーカス時にアクティブクラスが適用される", async () => {
  // モックコールバック
  const onChange = mock();

  // コンポーネントをレンダリング
  const { getByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
    { wrapper },
  );

  const list = getByRole("group");
  expect(list).not.toBeNull();

  // 初期状態ではアクティブクラスがないことを確認
  expect(list).toHaveClass("border-slate-900/20");
  expect(list).not.toHaveClass("border-slate-900");

  // 入力フィールドを取得
  const input = getByRole("textbox");
  expect(input).not.toBeNull();

  const user = userEvent.setup();
  await user.click(input); // focus.

  // アクティブ時のボーダー色が適用されることを確認
  expect(list).toHaveClass("border-slate-900");
  await user.click(document.body); // unfocus.

  // 非アクティブ時のボーダー色に戻ることを確認
  expect(list).toHaveClass("border-slate-900/20");
  expect(list).not.toHaveClass("border-slate-900");
});

test("フィールドセットをクリックすると入力フィールドにフォーカスが当たる", async () => {
  const onChange = mock();

  const { getByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
    { wrapper },
  );

  const fieldset = getByRole("group");
  const input = getByRole("textbox");

  const user = userEvent.setup();

  // フィールドセットの余白部分をクリック
  await user.click(fieldset);

  // 入力フィールドがフォーカスされていることを確認
  expect(document.activeElement).toBe(input);
});

test("タグやボタンをクリックしても入力フィールドにフォーカスが移動しない", async () => {
  const onChange = mock();

  const { getAllByRole, getByRole } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
    { wrapper },
  );

  const tagElements = getAllByRole("listitem");
  const removeButtons = getAllByRole("button", { name: "remove tag" });
  const input = getByRole("textbox");

  const user = userEvent.setup();

  // タグをクリック
  await user.click(tagElements[0]);

  // 入力フィールドにフォーカスが移動していないことを確認
  expect(document.activeElement).not.toBe(input);

  // 削除ボタンをクリック
  await user.click(removeButtons[0]);

  // 入力フィールドにフォーカスが移動していないことを確認
  expect(document.activeElement).not.toBe(input);
});

test("タグカウンターが正しく表示される", () => {
  const onChange = mock();

  const { getByTestId } = render(
    <InputTags tags={initialTags} onChange={onChange} />,
    { wrapper },
  );

  const counter = getByTestId("tag-counter");
  expect(counter).toHaveTextContent("3/10 tags");
});

test("タグが上限に達してもエラー表示はされない", () => {
  const onChange = mock();
  const maxTags = Array.from({ length: MAX_TAGS }, (_, i) => `tag${i}`);

  const { getByRole, getByTestId, queryByText } = render(
    <InputTags tags={maxTags} onChange={onChange} />,
    { wrapper },
  );

  // エラーボーダーが適用されていないこと
  const fieldset = getByRole("group");
  expect(fieldset).not.toHaveClass("border-red-500");

  // カウンターが10/10と表示されること
  const counter = getByTestId("tag-counter");
  expect(counter).toHaveTextContent("10/10 tags");

  // エラーメッセージが表示されていないこと
  expect(queryByText("Maximum 10 tags allowed")).toBeNull();
});

test("タグが上限に達すると入力フィールドが非表示になる", () => {
  const onChange = mock();
  const maxTags = Array.from({ length: MAX_TAGS }, (_, i) => `tag${i}`);

  const { queryByRole } = render(
    <InputTags tags={maxTags} onChange={onChange} />,
    { wrapper },
  );

  // 入力フィールドが存在しないこと
  expect(queryByRole("textbox")).toBeNull();
});

test("タグが上限近く（8個以上）で警告色が表示される", () => {
  const onChange = mock();
  const nearLimitTags = Array.from({ length: 8 }, (_, i) => `tag${i}`);

  const { getByTestId } = render(
    <InputTags tags={nearLimitTags} onChange={onChange} />,
    { wrapper },
  );

  const counter = getByTestId("tag-counter");
  expect(counter.parentElement).toHaveClass("text-amber-600");
});
