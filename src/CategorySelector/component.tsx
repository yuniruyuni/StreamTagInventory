import clsx from "clsx";
import { type FC, useState } from "react";

import type { Category } from "~/model/category";
import { CategoryInput } from "./CategoryInput";
import { CategoryList } from "./CategoryList";
import { useCategoryNavigation } from "./useCategoryNavigation";
import { useCategorySearch } from "./useCategorySearch";

type Props = {
  value?: Category;
  onChange: (category: Category) => void;
};

export const CategorySelector: FC<Props> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);

  const { query, setQuery, categories, cursor, setCursor, moveCursor } =
    useCategorySearch({
      initialCategory: value,
      onCategoryFound: onChange,
    });

  const { handleKeyDown, handleSelectCategory } = useCategoryNavigation({
    categories,
    cursor,
    moveCursor,
    query,
    setQuery,
    setOpen,
    onChange,
    value,
  });

  return (
    <div className="dropdown relative">
      <CategoryInput
        value={value}
        query={query}
        open={open}
        setOpen={setOpen}
        setQuery={setQuery}
        onKeyDown={handleKeyDown}
        onChange={onChange}
        categories={categories}
      />

      <div
        data-testid="dropdown-content"
        className={clsx(
          open ? "visible" : "invisible",
          "absolute top-0",
          "w-full h-fit",
          "border border-slate-300",
          "outline outline-slate-200",
          "bg-base-100",
          "rounded",
        )}
      >
        <CategoryList
          categories={categories}
          cursor={cursor}
          setCursor={setCursor}
          onSelect={handleSelectCategory}
        />
      </div>
    </div>
  );
};
