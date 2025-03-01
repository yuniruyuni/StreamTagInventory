import { expect, test } from "bun:test";
import { EmptyCategory, newCategory } from "./category";

test("newCategory関数が新しいカテゴリを作成する", () => {
  const category = newCategory();

  // 各プロパティが初期値であることを確認
  expect(category.id).toBe("");
  expect(category.name).toBe("");
  expect(category.box_art_url).toBe("");
});

test("EmptyCategoryが空のカテゴリオブジェクトである", () => {
  // EmptyCategoryがnewCategory関数の結果と同じであることを確認
  expect(EmptyCategory).toEqual(newCategory());

  // 各プロパティが空文字列であることを確認
  expect(EmptyCategory.id).toBe("");
  expect(EmptyCategory.name).toBe("");
  expect(EmptyCategory.box_art_url).toBe("");
});

test("Category型が正しいプロパティを持つ", () => {
  // カスタムカテゴリオブジェクトを作成
  const customCategory = {
    id: "123",
    name: "テストカテゴリ",
    box_art_url: "https://example.com/image.jpg",
  };

  // 型が正しいことを確認（構造的に互換性があるか）
  const category: typeof EmptyCategory = customCategory;

  // 各プロパティが正しく設定されていることを確認
  expect(category.id).toBe("123");
  expect(category.name).toBe("テストカテゴリ");
  expect(category.box_art_url).toBe("https://example.com/image.jpg");
});
