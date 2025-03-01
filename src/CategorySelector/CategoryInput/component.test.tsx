import { expect, test } from "bun:test";
import type { Category } from "~/model/category";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { CategoryInput } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("CategoryInputコンポーネントが正しくレンダリングされる", () => {
  const query = "";
  const open = false;
  const setOpen = () => {};
  const setQuery = () => {};
  const onKeyDown = () => {};
  const onChange = () => {};

  const root = renderComponent(
    <CategoryInput
      query={query}
      open={open}
      setOpen={setOpen}
      setQuery={setQuery}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />,
  );

  // ラベル要素が存在することを確認
  const label = root?.querySelector("label");
  expect(label).not.toBeNull();

  // 入力フィールドが存在することを確認
  const input = label?.querySelector("input");
  expect(input).not.toBeNull();
  expect(input?.getAttribute("type")).toBe("text");
  expect(input?.getAttribute("placeholder")).toBe("Pick a category");
  expect(input?.value).toBe("");
});

test("valueが指定されている場合、画像が表示される", () => {
  const value: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const query = "テストカテゴリ";
  const open = false;
  const setOpen = () => {};
  const setQuery = () => {};
  const onKeyDown = () => {};
  const onChange = () => {};

  const root = renderComponent(
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
  const image = root?.querySelector("img");
  expect(image).not.toBeNull();
  expect(image?.getAttribute("src")).toBe("https://example.com/image.jpg");
  expect(image?.getAttribute("alt")).toBe("テストカテゴリ");
});

test("openがtrueの場合、適切なクラスが適用される", () => {
  const query = "";
  const open = true;
  const setOpen = () => {};
  const setQuery = () => {};
  const onKeyDown = () => {};
  const onChange = () => {};

  const root = renderComponent(
    <CategoryInput
      query={query}
      open={open}
      setOpen={setOpen}
      setQuery={setQuery}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />,
  );

  const input = root?.querySelector("input");
  expect(input?.className).toContain("border-b-0");
  expect(input?.className).toContain("rounded-b-none");
});

test("フォーカス時にsetOpenが呼び出される", () => {
  const query = "";
  const open = false;
  let openState = false;
  const setOpen = (value: boolean) => {
    openState = value;
  };
  const setQuery = () => {};
  const onKeyDown = () => {};
  const onChange = () => {};

  const root = renderComponent(
    <CategoryInput
      query={query}
      open={open}
      setOpen={setOpen}
      setQuery={setQuery}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />,
  );

  const input = root?.querySelector("input");
  expect(input).not.toBeNull();

  // フォーカスイベントをシミュレート
  input?.focus();

  // setOpenが正しく呼び出されたか確認
  expect(openState).toBe(true);
});

test("ブラー時にsetOpenとsetQueryが呼び出される", () => {
  const value: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const query = "テスト";
  const open = true;
  let openState = true;
  let queryState = "テスト";
  const setOpen = (value: boolean) => {
    openState = value;
  };
  const setQuery = (value: string) => {
    queryState = value;
  };
  const onKeyDown = () => {};
  const onChange = () => {};

  const root = renderComponent(
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

  const input = root?.querySelector("input");
  expect(input).not.toBeNull();

  // フォーカスしてからブラーイベントをシミュレート
  input?.focus();
  input?.blur();

  // setOpenとsetQueryが正しく呼び出されたか確認
  expect(openState).toBe(false);
  expect(queryState).toBe("テストカテゴリ");
});
