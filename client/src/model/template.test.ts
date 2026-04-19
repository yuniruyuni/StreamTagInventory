import { describe, expect, mock, test } from "bun:test";
import { newCategory } from "./category";
import {
  cloneTemplate,
  isTemplateEqual,
  newTemplate,
  type Template,
  validateTemplate,
} from "./template";

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

describe("isTemplateEqual", () => {
  const base: Template = {
    id: "t1",
    title: "Title",
    category: { id: "1", name: "A", box_art_url: "u" },
    tags: ["x", "y"],
  };

  test("identical templates are equal", () => {
    expect(isTemplateEqual(base, { ...base })).toBe(true);
  });

  test("ignores extra fields not in Category type (e.g. igdb_id)", () => {
    // Twitch API / e2e mock が返す category には igdb_id 等の追加フィールドが
    // 入っており、`JSON.stringify` 比較だと差異が出てしまう。本関数は宣言済
    // フィールドだけを見るので等価判定する。
    const withExtra = {
      ...base,
      category: {
        ...base.category,
        igdb_id: "extra",
      } as unknown as Template["category"],
    };
    expect(isTemplateEqual(base, withExtra)).toBe(true);
  });

  test("title diff", () => {
    expect(isTemplateEqual(base, { ...base, title: "Other" })).toBe(false);
  });

  test("category id diff", () => {
    expect(
      isTemplateEqual(base, {
        ...base,
        category: { ...base.category, id: "9" },
      }),
    ).toBe(false);
  });

  test("tags diff (length)", () => {
    expect(isTemplateEqual(base, { ...base, tags: ["x"] })).toBe(false);
  });

  test("tags diff (content / order)", () => {
    expect(isTemplateEqual(base, { ...base, tags: ["y", "x"] })).toBe(false);
  });
});
