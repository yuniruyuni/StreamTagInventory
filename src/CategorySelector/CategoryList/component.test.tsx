import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import type { Category } from "~/model/category";
import { CategoryList } from "./component";

test("カテゴリがある場合、各カテゴリが表示される", () => {
  const categories: Category[] = [
    {
      id: "123",
      name: "カテゴリ1",
      box_art_url: "https://example.com/image1.jpg",
    },
    {
      id: "456",
      name: "カテゴリ2",
      box_art_url: "https://example.com/image2.jpg",
    },
    {
      id: "789",
      name: "カテゴリ3",
      box_art_url: "https://example.com/image3.jpg",
    },
  ];
  const cursor = 0;
  const setCursor = mock();
  const onSelect = mock();

  const { getByRole, getAllByRole } = render(
    <CategoryList
      categories={categories}
      cursor={cursor}
      setCursor={setCursor}
      onSelect={onSelect}
    />,
  );

  // リスト要素が存在することを確認
  const list = getByRole("list");
  expect(list).not.toBeNull();

  // リスト項目の数を確認
  const items = getAllByRole("listitem");
  expect(items.length).toBe(3);

  // 各カテゴリの内容を確認
  const images = getAllByRole("img");
  expect(images.length).toBe(3);
  expect(images[0]).toHaveAttribute("src", "https://example.com/image1.jpg");
  expect(images[1]).toHaveAttribute("src", "https://example.com/image2.jpg");
  expect(images[2]).toHaveAttribute("src", "https://example.com/image3.jpg");
  expect(images[0]).toHaveAttribute("alt", "カテゴリ1");
  expect(images[1]).toHaveAttribute("alt", "カテゴリ2");
  expect(images[2]).toHaveAttribute("alt", "カテゴリ3");
});

test("カーソル位置に対応するカテゴリが選択状態になる", () => {
  const categories: Category[] = [
    {
      id: "123",
      name: "カテゴリ1",
      box_art_url: "https://example.com/image1.jpg",
    },
    {
      id: "456",
      name: "カテゴリ2",
      box_art_url: "https://example.com/image2.jpg",
    },
    {
      id: "789",
      name: "カテゴリ3",
      box_art_url: "https://example.com/image3.jpg",
    },
  ];
  const cursor = 1; // 2番目のカテゴリを選択(0-origなため1)
  const setCursor = mock();
  const onSelect = mock();

  const { getAllByRole } = render(
    <CategoryList
      categories={categories}
      cursor={cursor}
      setCursor={setCursor}
      onSelect={onSelect}
    />,
  );

  // ボタン要素を取得
  const buttons = getAllByRole("button");
  expect(buttons.length).toBe(3);

  // 2番目のボタンが選択状態になっていることを確認
  expect(buttons[0]).not.toHaveClass("bg-hover-bg");
  expect(buttons[1]).toHaveClass("bg-hover-bg");
  expect(buttons[2]).not.toHaveClass("bg-hover-bg");
});
