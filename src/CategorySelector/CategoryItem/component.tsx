import clsx from "clsx";
import type React from "react";
import type { Category } from "~/model/category";

type Props = {
  category: Category;
  isSelected: boolean;
  onSelect: (category: Category) => void;
  onMouseEnter: () => void;
};

export const CategoryItem: React.FC<Props> = ({
  category,
  isSelected,
  onSelect,
  onMouseEnter,
}) => {
  return (
    <li>
      <button
        type="button"
        className={clsx(isSelected && "bg-slate-100")}
        onMouseDown={(e) => {
          e.preventDefault();
          onSelect(category);
        }}
        onMouseEnter={onMouseEnter}
      >
        {category.box_art_url && (
          <img
            src={category.box_art_url
              .replace("{width}", "52")
              .replace("{height}", "72")}
            alt={category.name}
          />
        )}
        {category.name}
      </button>
    </li>
  );
};
