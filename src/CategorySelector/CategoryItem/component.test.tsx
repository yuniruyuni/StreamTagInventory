import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Category } from "~/model/category";
import { CategoryItem } from "./component";

test("CategoryItemコンポーネントが正しくレンダリングされる", () => {
  const category: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const isSelected = false;
  const onSelect = mock();
  const onMouseEnter = mock();

  const { getByRole } = render(
    <CategoryItem
      category={category}
      isSelected={isSelected}
      onSelect={onSelect}
      onMouseEnter={onMouseEnter}
    />,
  );

  // リスト要素が存在することを確認
  const listItem = getByRole("listitem");
  expect(listItem).not.toBeNull();

  // ボタン要素が存在することを確認
  const button = getByRole("button");
  expect(button).not.toBeNull();

  // 画像要素が存在することを確認
  const image = getByRole("img");
  expect(image).not.toBeNull();
  expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
  expect(image).toHaveAttribute("alt", "テストカテゴリ");

  // カテゴリ名が表示されていることを確認
  expect(button).toHaveTextContent("テストカテゴリ");
});

test("選択されている場合、適切なクラスが適用される", () => {
  const category: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const isSelected = true;
  const onSelect = mock();
  const onMouseEnter = mock();

  const { getByRole } = render(
    <CategoryItem
      category={category}
      isSelected={isSelected}
      onSelect={onSelect}
      onMouseEnter={onMouseEnter}
    />,
  );

  const button = getByRole("button");
  expect(button).toHaveClass("bg-hover-bg");
});

test("選択されていない場合、選択クラスが適用されない", () => {
  const category: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const isSelected = false;
  const onSelect = mock();
  const onMouseEnter = mock();

  const { getByRole } = render(
    <CategoryItem
      category={category}
      isSelected={isSelected}
      onSelect={onSelect}
      onMouseEnter={onMouseEnter}
    />,
  );

  const button = getByRole("button");
  expect(button).not.toHaveClass("bg-hover-bg");
});

test("ボタンがクリックされたとき、onSelect関数が呼び出される", async () => {
  const category: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const isSelected = false;
  const onSelect = mock();
  const onMouseEnter = mock();

  const { getByRole } = render(
    <CategoryItem
      category={category}
      isSelected={isSelected}
      onSelect={onSelect}
      onMouseEnter={onMouseEnter}
    />,
  );

  const user = userEvent.setup();

  const button = getByRole("button");
  await user.click(button);

  expect(onSelect).toBeCalledWith(category);
});
