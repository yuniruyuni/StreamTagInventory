import type { Category } from '~/model/category';

export type Template = {
  id: string;
  title: string;
  category: Category;
  tags: string[];
};
