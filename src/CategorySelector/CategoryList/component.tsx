import React from "react";
import { MenuList } from "~/components/MenuList";
import type { Category } from "~/model/category";
import { CategoryItem } from "../CategoryItem";

type Props = {
  categories: Category[];
  cursor: number;
  setCursor: (index: number) => void;
  onSelect: (category: Category) => void;
};

export const CategoryList: React.FC<Props> = ({
  categories,
  cursor,
  setCursor,
  onSelect,
}) => {
  const ref = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (!ref.current || categories.length === 0) return;

    ref.current.children[cursor]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [cursor, categories]);

  return (
    <MenuList
      ref={ref}
      className="w-full max-h-80 py-0 p-2 flex-nowrap overflow-auto"
    >
      {categories.map((item, index) => (
        <CategoryItem
          key={item.id}
          category={item}
          isSelected={index === cursor}
          onSelect={onSelect}
          onMouseEnter={() => setCursor(index)}
        />
      ))}
    </MenuList>
  );
};
