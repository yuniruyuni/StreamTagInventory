import { ulid } from "ulid";
import { type Category, newCategory } from "~/model/category";

export type Template = {
  id: string;
  title: string;
  category: Category;
  tags: string[];
};

export function newTemplate(): Template {
  return {
    id: ulid(),
    title: "",
    category: newCategory(),
    tags: [],
  };
}

export function cloneTemplate(template: Template): Template {
  return { ...template, id: ulid() };
}

export function validateTemplate(template: Template): boolean {
  if (template.title === "") return false;
  if (template.category.id === "") return false;
  if (template.tags.length === 0) return false;
  if (10 < template.tags.length) return false;
  if (template.tags.some((tag) => tag === "")) return false;

  return true;
}

/**
 * Template の意味上のフィールドだけを比較する。
 *
 * Twitch API レスポンス (および e2e mock) は Category 型に宣言の無い追加
 * フィールド (igdb_id 等) を含み、CategorySelector を経由すると edit buffer
 * (temp) にそのまま入る。一方 Y.Doc の roundtrip (PR 7) では宣言フィールドだけ
 * しか保存しないため、`JSON.stringify` で比較すると保存後も常に diff となり、
 * 「未保存」状態のまま固まる。Template / Category 型のフィールドのみを構造比較
 * することで、宣言外フィールドの有無を無視できる。
 */
export function isTemplateEqual(a: Template, b: Template): boolean {
  if (a.id !== b.id) return false;
  if (a.title !== b.title) return false;
  if (a.category.id !== b.category.id) return false;
  if (a.category.name !== b.category.name) return false;
  if (a.category.box_art_url !== b.category.box_art_url) return false;
  if (a.tags.length !== b.tags.length) return false;
  for (let i = 0; i < a.tags.length; i++) {
    if (a.tags[i] !== b.tags[i]) return false;
  }
  return true;
}
