import clsx from "clsx";
import { type FC, memo, useCallback, useState } from "react";

import type { Category } from "~/model/category";
import { CategoryInput } from "./CategoryInput";
import { CategoryList } from "./CategoryList";
import { useCategoryNavigation } from "./useCategoryNavigation";
import { useCategorySearch } from "./useCategorySearch";
import { useCursor } from "./useCursor";

type Props = {
  value?: Category;
  onChange: (category: Category) => void;
};

export const CategorySelector: FC<Props> = memo(({ value, onChange }) => {
  const [open, setOpen] = useState(false);

  const { cursor, setCursor, moveCursor, resetCursor } = useCursor();

  const { query, setQuery, categories } = useCategorySearch({
    initialCategory: value,
    onCategoryFound: onChange,
    onCursorReset: resetCursor,
    onCursorSet: setCursor,
  });

  const { handleKeyDown, handleSelectCategory } = useCategoryNavigation({
    categories,
    cursor,
    moveCursor: (diff) => moveCursor(diff, categories?.length ?? 0),
    query,
    setQuery,
    setOpen,
    onChange,
    value,
  });

  const hasResults = categories !== undefined && categories.length > 0;
  const showDropdown = open && hasResults;

  const handleFocus = useCallback(() => {
    setOpen(true);
  }, []);

  const handleBlur = useCallback(() => {
    setOpen(false);
    setQuery(value?.name ?? "");
  }, [setQuery, value]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      const found = categories?.find((item) => item.name === e.target.value);
      if (!found) return;
      onChange(found);
    },
    [setQuery, categories, onChange],
  );

  return (
    <div className="relative">
      <CategoryInput
        value={value}
        query={query}
        open={showDropdown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
      />

      {showDropdown && (
        <div
          data-testid="dropdown-content"
          className={clsx(
            "absolute top-full left-0",
            "w-full h-fit",
            "border border-t-0 border-on-surface",
            "bg-surface",
            "rounded-b",
          )}
        >
          <CategoryList
            categories={categories}
            cursor={cursor}
            setCursor={setCursor}
            onSelect={handleSelectCategory}
          />
        </div>
      )}
    </div>
  );
});
