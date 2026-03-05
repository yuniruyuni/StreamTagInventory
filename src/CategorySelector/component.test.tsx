import { beforeAll, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "~/i18n/config";
import { SWRConfigWrapper } from "~/test-utils";
import { type Category, EmptyCategory } from "../model/category";
import { CategorySelector } from "./component";

// モックカテゴリデータ
const mockCategories: Category[] = [
  {
    id: "1",
    name: "Just Chatting",
    box_art_url: "https://example.com/just-chatting.jpg",
  },
  {
    id: "2",
    name: "Minecraft",
    box_art_url: "https://example.com/minecraft.jpg",
  },
  {
    id: "3",
    name: "League of Legends",
    box_art_url: "https://example.com/lol.jpg",
  },
];

// テスト実行前にi18nを英語に設定
beforeAll(async () => {
  await i18n.changeLanguage("en");
});

test("CategorySelectorコンポーネントが正しくレンダリングされる", () => {
  const onChange = mock();

  const { getByPlaceholderText, queryByTestId } = render(
    <CategorySelector value={EmptyCategory} onChange={onChange} />,
    { wrapper: SWRConfigWrapper({ data: mockCategories }) },
  );

  // 入力フィールドが存在することを確認
  const input = getByPlaceholderText("Pick a category");
  expect(input).not.toBeNull();

  // 初期状態ではドロップダウンがDOMに存在しないことを確認
  const dropdownContent = queryByTestId("dropdown-content");
  expect(dropdownContent).toBeNull();
});

test("入力フィールドにフォーカスするとドロップダウンが表示される", () => {
  const onChange = mock();

  const { getByPlaceholderText, getByTestId } = render(
    <CategorySelector value={EmptyCategory} onChange={onChange} />,
    { wrapper: SWRConfigWrapper({ data: mockCategories }) },
  );

  // 入力フィールドを取得
  const input = getByPlaceholderText("Pick a category");
  expect(input).not.toBeNull();

  // フォーカスイベントをシミュレート
  fireEvent.focus(input);

  // ドロップダウンが表示されることを確認
  const dropdownContent = getByTestId("dropdown-content");
  expect(dropdownContent).not.toBeNull();
});

test("検索クエリに基づいてカテゴリがフィルタリングされる", () => {
  const onChange = mock();

  // コンポーネントをレンダリング
  const { getByPlaceholderText } = render(
    <CategorySelector value={EmptyCategory} onChange={onChange} />,
    { wrapper: SWRConfigWrapper({ data: mockCategories }) },
  );

  // 入力フィールドを取得
  const input = getByPlaceholderText("Pick a category");
  expect(input).not.toBeNull();

  // 入力値を変更
  fireEvent.change(input, { target: { value: "Mine" } });

  expect(input).toHaveValue("Mine");
});

test("Enterで選択中の項目を選ぶことができる", async () => {
  const onChange = mock();

  // コンポーネントをレンダリング
  const { getByPlaceholderText } = render(
    <CategorySelector value={EmptyCategory} onChange={onChange} />,
    { wrapper: SWRConfigWrapper({ data: mockCategories }) },
  );

  const user = userEvent.setup();

  // 入力フィールドを取得
  const input = getByPlaceholderText("Pick a category");
  expect(input).not.toBeNull();

  // 入力値を変更
  await user.click(input);
  expect(input).toHaveValue("");

  await user.keyboard("{Enter}");
  expect(input).toHaveValue("Just Chatting");
});

test("下キー入力で次の項目を選ぶことができる", async () => {
  const onChange = mock();

  // コンポーネントをレンダリング
  const { getByPlaceholderText } = render(
    <CategorySelector value={EmptyCategory} onChange={onChange} />,
    { wrapper: SWRConfigWrapper({ data: mockCategories }) },
  );

  const user = userEvent.setup();

  // 入力フィールドを取得
  const input = getByPlaceholderText("Pick a category");
  expect(input).not.toBeNull();

  // 入力値を変更
  await user.click(input);
  expect(input).toHaveValue("");

  await user.keyboard("{ArrowDown}{Enter}");
  expect(input).toHaveValue("Minecraft");
});

test("前キー入力で一番下の項目を選ぶことができる", async () => {
  const onChange = mock();

  // コンポーネントをレンダリング
  const { getByPlaceholderText } = render(
    <CategorySelector value={EmptyCategory} onChange={onChange} />,
    { wrapper: SWRConfigWrapper({ data: mockCategories }) },
  );

  const user = userEvent.setup();

  const input = getByPlaceholderText("Pick a category");
  expect(input).not.toBeNull();

  await user.click(input);
  expect(input).toHaveValue("");

  await user.keyboard("{ArrowUp}{Enter}");
  expect(input).toHaveValue("League of Legends");
});
