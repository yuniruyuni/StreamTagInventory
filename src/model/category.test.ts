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
