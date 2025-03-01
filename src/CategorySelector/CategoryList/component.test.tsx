import { expect, test } from "bun:test";
import type { Category } from "~/model/category";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { CategoryList } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("カテゴリが空の場合、何も表示されない", () => {
  const categories: Category[] = [];
  const cursor = 0;
  const setCursor = () => {};
  const onSelect = () => {};

  const root = renderComponent(
    <CategoryList
      categories={categories}
      cursor={cursor}
      setCursor={setCursor}
      onSelect={onSelect}
    />,
  );

  // リスト要素が存在しないことを確認
  const list = root?.querySelector("ul");
  expect(list).toBeNull();
});

test("カテゴリがundefinedの場合、何も表示されない", () => {
  const categories = undefined;
  const cursor = 0;
  const setCursor = () => {};
  const onSelect = () => {};

  const root = renderComponent(
    <CategoryList
      categories={categories}
      cursor={cursor}
      setCursor={setCursor}
      onSelect={onSelect}
    />,
  );

  // リスト要素が存在しないことを確認
  const list = root?.querySelector("ul");
  expect(list).toBeNull();
});

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
  const setCursor = () => {};
  const onSelect = () => {};

  const root = renderComponent(
    <CategoryList
      categories={categories}
      cursor={cursor}
      setCursor={setCursor}
      onSelect={onSelect}
    />,
  );

  // リスト要素が存在することを確認
  const list = root?.querySelector("ul");
  expect(list).not.toBeNull();

  // リスト項目の数を確認
  const items = list?.querySelectorAll("li");
  expect(items?.length).toBe(3);

  // 各カテゴリの内容を確認
  const images = list?.querySelectorAll("img");
  expect(images?.length).toBe(3);
  expect(images?.[0].getAttribute("src")).toBe(
    "https://example.com/image1.jpg",
  );
  expect(images?.[1].getAttribute("src")).toBe(
    "https://example.com/image2.jpg",
  );
  expect(images?.[2].getAttribute("src")).toBe(
    "https://example.com/image3.jpg",
  );
  expect(images?.[0].getAttribute("alt")).toBe("カテゴリ1");
  expect(images?.[1].getAttribute("alt")).toBe("カテゴリ2");
  expect(images?.[2].getAttribute("alt")).toBe("カテゴリ3");
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
  const cursor = 1; // 2番目のカテゴリを選択
  const setCursor = () => {};
  const onSelect = () => {};

  const root = renderComponent(
    <CategoryList
      categories={categories}
      cursor={cursor}
      setCursor={setCursor}
      onSelect={onSelect}
    />,
  );

  // ボタン要素を取得
  const buttons = root?.querySelectorAll("button");
  expect(buttons?.length).toBe(3);

  // 2番目のボタンが選択状態になっていることを確認
  expect(buttons?.[0].className).not.toContain("bg-slate-100");
  expect(buttons?.[1].className).toContain("bg-slate-100");
  expect(buttons?.[2].className).not.toContain("bg-slate-100");
});
