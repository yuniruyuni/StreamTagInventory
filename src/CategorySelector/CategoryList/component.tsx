import clsx from "clsx";
import React from "react";
import type { Category } from "~/model/category";
import { CategoryItem } from "../CategoryItem";

type Props = {
  categories: Category[] | undefined;
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
    if (!ref.current || !categories || categories.length === 0) return;

    ref.current.children[cursor]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [cursor, categories]);

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <ul
      ref={ref}
      className={clsx(
        "menu",
        "mt-24",
        "w-full max-h-80 py-0 p-2",
        "flex-nowrap overflow-auto",
      )}
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
    </ul>
  );
};
