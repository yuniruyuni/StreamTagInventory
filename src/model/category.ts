export type Category = {
  id: string;
  name: string;
  box_art_url: string;
};

export function newCategory() : Category {
  return {
    id: "",
    name: "",
    box_art_url: "",
  };
}

export const EmptyCategory = newCategory();
