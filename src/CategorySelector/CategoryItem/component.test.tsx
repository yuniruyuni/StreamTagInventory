import { expect, test } from "bun:test";
import type { Category } from "~/model/category";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { CategoryItem } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("CategoryItemコンポーネントが正しくレンダリングされる", () => {
  const category: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const onSelect = () => {};
  const onMouseEnter = () => {};

  const root = renderComponent(
    <CategoryItem
      category={category}
      isSelected={false}
      onSelect={onSelect}
      onMouseEnter={onMouseEnter}
    />,
  );

  // リスト要素が存在することを確認
  const listItem = root?.querySelector("li");
  expect(listItem).not.toBeNull();

  // ボタン要素が存在することを確認
  const button = listItem?.querySelector("button");
  expect(button).not.toBeNull();

  // 画像要素が存在することを確認
  const image = button?.querySelector("img");
  expect(image).not.toBeNull();
  expect(image?.getAttribute("src")).toBe("https://example.com/image.jpg");
  expect(image?.getAttribute("alt")).toBe("テストカテゴリ");

  // カテゴリ名が表示されていることを確認
  expect(button?.textContent).toContain("テストカテゴリ");
});

test("選択されている場合、適切なクラスが適用される", () => {
  const category: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const onSelect = () => {};
  const onMouseEnter = () => {};

  const root = renderComponent(
    <CategoryItem
      category={category}
      isSelected={true}
      onSelect={onSelect}
      onMouseEnter={onMouseEnter}
    />,
  );

  const button = root?.querySelector("button");
  expect(button?.className).toContain("bg-slate-100");
});

test("選択されていない場合、選択クラスが適用されない", () => {
  const category: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  const onSelect = () => {};
  const onMouseEnter = () => {};

  const root = renderComponent(
    <CategoryItem
      category={category}
      isSelected={false}
      onSelect={onSelect}
      onMouseEnter={onMouseEnter}
    />,
  );

  const button = root?.querySelector("button");
  expect(button?.className).not.toContain("bg-slate-100");
});

test("ボタンがクリックされたとき、onSelect関数が呼び出される", () => {
  const category: Category = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };
  // 型を明示的に指定して、型エラーを回避
  let selectedCategory: Category | null = null;
  const onSelect = (cat: Category) => {
    selectedCategory = cat;
  };
  const onMouseEnter = () => {};

  const root = renderComponent(
    <CategoryItem
      category={category}
      isSelected={false}
      onSelect={onSelect}
      onMouseEnter={onMouseEnter}
    />,
  );

  const button = root?.querySelector("button");
  expect(button).not.toBeNull();

  // MouseDownイベントをシミュレート
  const mouseDownEvent = new window.MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
  });
  button?.dispatchEvent(mouseDownEvent);

  // onSelectが正しいカテゴリで呼び出されたか確認
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に型チェックを無視
  expect(selectedCategory as any).toEqual(category);
});
