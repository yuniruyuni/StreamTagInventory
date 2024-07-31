import type { Category } from '~/model/category';

export type Template = {
  title: string;
  category: Category;
  tags: string[];
};
