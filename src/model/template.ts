import { ulid } from 'ulid';
import { type Category, newCategory } from '~/model/category';
import type { CCLSelection } from '~/model/ccl';

export type Template = {
  id: string;
  title: string;
  category: Category;
  tags: string[];
  ccls: CCLSelection[];
};


export function newTemplate(): Template {
  return {
    id: ulid(),
    title: "",
    category: newCategory(),
    tags: [],
    ccls: [],
  };
}

export function cloneTemplate(template: Template): Template {
  return {...template, id: ulid() };
}


export function validateTemplate(template: Template): boolean {
  if (template.title === "") return false;
  if (template.category.id === "") return false;
  if (template.tags.length === 0) return false;
  if (10 < template.tags.length) return false;
  if (template.tags.some((tag) => tag === "")) return false;

  return true;
}
