import { expect, mock, test } from "bun:test";
import { newCategory } from "./category";
import { cloneTemplate, newTemplate, validateTemplate } from "./template";

// ulidのモック
mock.module("ulid", () => {
  return {
    ulid: () => "mock-ulid-value",
  };
});

test("newTemplate関数が新しいテンプレートを作成する", () => {
  const template = newTemplate();

  // IDがulidで生成されていることを確認
  expect(template.id).toBe("mock-ulid-value");

  // 他のプロパティが初期値であることを確認
  expect(template.title).toBe("");
  expect(template.category).toEqual(newCategory());
  expect(template.tags).toEqual([]);
});

test("cloneTemplate関数がテンプレートを複製する", () => {
  const originalTemplate = {
    id: "original-id",
    title: "テストタイトル",
    category: {
      id: "category-id",
      name: "テストカテゴリ",
      box_art_url: "https://example.com/image.jpg",
    },
    tags: ["タグ1", "タグ2"],
  };

  const clonedTemplate = cloneTemplate(originalTemplate);

  // IDが新しく生成されていることを確認
  expect(clonedTemplate.id).toBe("mock-ulid-value");
  expect(clonedTemplate.id).not.toBe(originalTemplate.id);

  // 他のプロパティが元のテンプレートと同じであることを確認
  expect(clonedTemplate.title).toBe(originalTemplate.title);
  expect(clonedTemplate.category).toEqual(originalTemplate.category);
  expect(clonedTemplate.tags).toEqual(originalTemplate.tags);
});

test("validateTemplate関数が有効なテンプレートを検証する", () => {
  const validTemplate = {
    id: "test-id",
    title: "テストタイトル",
    category: {
      id: "category-id",
      name: "テストカテゴリ",
      box_art_url: "https://example.com/image.jpg",
    },
    tags: ["タグ1", "タグ2"],
  };

  expect(validateTemplate(validTemplate)).toBe(true);
});

test("validateTemplate関数がタイトルが空のテンプレートを無効と判定する", () => {
  const invalidTemplate = {
    id: "test-id",
    title: "", // 空のタイトル
    category: {
      id: "category-id",
      name: "テストカテゴリ",
      box_art_url: "https://example.com/image.jpg",
    },
    tags: ["タグ1", "タグ2"],
  };

  expect(validateTemplate(invalidTemplate)).toBe(false);
});

test("validateTemplate関数がカテゴリIDが空のテンプレートを無効と判定する", () => {
  const invalidTemplate = {
    id: "test-id",
    title: "テストタイトル",
    category: {
      id: "", // 空のカテゴリID
      name: "テストカテゴリ",
      box_art_url: "https://example.com/image.jpg",
    },
    tags: ["タグ1", "タグ2"],
  };

  expect(validateTemplate(invalidTemplate)).toBe(false);
});

test("validateTemplate関数がタグが空のテンプレートを無効と判定する", () => {
  const invalidTemplate = {
    id: "test-id",
    title: "テストタイトル",
    category: {
      id: "category-id",
      name: "テストカテゴリ",
      box_art_url: "https://example.com/image.jpg",
    },
    tags: [], // 空のタグ配列
  };

  expect(validateTemplate(invalidTemplate)).toBe(false);
});

test("validateTemplate関数がタグが10個を超えるテンプレートを無効と判定する", () => {
  const invalidTemplate = {
    id: "test-id",
    title: "テストタイトル",
    category: {
      id: "category-id",
      name: "テストカテゴリ",
      box_art_url: "https://example.com/image.jpg",
    },
    tags: [
      "タグ1",
      "タグ2",
      "タグ3",
      "タグ4",
      "タグ5",
      "タグ6",
      "タグ7",
      "タグ8",
      "タグ9",
      "タグ10",
      "タグ11",
    ], // 11個のタグ
  };

  expect(validateTemplate(invalidTemplate)).toBe(false);
});

test("validateTemplate関数が空のタグを含むテンプレートを無効と判定する", () => {
  const invalidTemplate = {
    id: "test-id",
    title: "テストタイトル",
    category: {
      id: "category-id",
      name: "テストカテゴリ",
      box_art_url: "https://example.com/image.jpg",
    },
    tags: ["タグ1", ""], // 空のタグを含む
  };

  expect(validateTemplate(invalidTemplate)).toBe(false);
});
