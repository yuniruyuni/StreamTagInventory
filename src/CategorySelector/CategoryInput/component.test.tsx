import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Category } from "~/model/category";
import { CategoryInput } from "./component";

test("CategoryInputコンポーネントが正しくレンダリングされる", () => {
  const query = "";
  const open = false;
  const setOpen = mock();
  const setQuery = mock();
  const onKeyDown = mock();
  const onChange = mock();

  const { getByRole, getByTestId } = render(
    <CategoryInput
      query={query}
      open={open}
      setOpen={setOpen}
      setQuery={setQuery}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />,
  );

  const label = getByTestId("thumbnail");
  expect(label).not.toBeNull();

  const input = getByRole("textbox");
  expect(input).not.toBeNull();
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveAttribute("placeholder", "Pick a category");
  expect(input).toHaveValue("");
});

test("valueが指定されている場合、画像が表示される", () => {
  const value: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const query = "テストカテゴリ";
  const open = false;
  const setOpen = mock();
  const setQuery = mock();
  const onKeyDown = mock();
  const onChange = mock();

  const { getByRole } = render(
    <CategoryInput
      value={value}
      query={query}
      open={open}
      setOpen={setOpen}
      setQuery={setQuery}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />,
  );

  // 画像要素が存在することを確認
  const image = getByRole("img");
  expect(image).not.toBeNull();
  expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
  expect(image).toHaveAttribute("alt", "テストカテゴリ");
});

test("openがtrueの場合、適切なクラスが適用される", () => {
  const query = "";
  const open = true;
  const setOpen = mock();
  const setQuery = mock();
  const onKeyDown = mock();
  const onChange = mock();

  const { getByRole } = render(
    <CategoryInput
      query={query}
      open={open}
      setOpen={setOpen}
      setQuery={setQuery}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />,
  );

  const input = getByRole("textbox");
  expect(input).toHaveClass("border-b-0");
  expect(input).toHaveClass("rounded-b-none");
});

test("フォーカス時にsetOpenが呼び出される", async () => {
  const query = "";
  const open = false;
  const setOpen = mock();
  const setQuery = mock();
  const onKeyDown = mock();
  const onChange = mock();

  const { getByPlaceholderText } = render(
    <CategoryInput
      query={query}
      open={open}
      setOpen={setOpen}
      setQuery={setQuery}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />,
  );

  const user = userEvent.setup();

  const input = getByPlaceholderText("Pick a category");
  await user.click(input);

  expect(setOpen).toBeCalledWith(true);
});

test("ブラー時にsetOpenとsetQueryが呼び出される", async () => {
  const value: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const query = "テスト";
  const open = false;
  const setOpen = mock();
  const setQuery = mock();
  const onKeyDown = mock();
  const onChange = mock();

  const { getByPlaceholderText } = render(
    <CategoryInput
      value={value}
      query={query}
      open={open}
      setOpen={setOpen}
      setQuery={setQuery}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />,
  );

  const user = userEvent.setup();

  const input = getByPlaceholderText("Pick a category");
  expect(input).not.toBeNull();

  await user.click(input); // focus.
  await user.click(document.body); // unfocus.

  expect(setOpen).toBeCalledWith(false);
  expect(setQuery).toBeCalledWith("テストカテゴリ");
});
