import { useCallback } from "react";
import type { Category } from "~/model/category";

type UseCategoryNavigationProps = {
  categories?: Category[];
  cursor: number;
  moveCursor: (diff: number) => void;
  query: string;
  setQuery: (query: string) => void;
  setOpen: (open: boolean) => void;
  onChange: (category: Category) => void;
  value?: Category;
};

export const useCategoryNavigation = ({
  categories,
  cursor,
  moveCursor,
  query,
  setQuery,
  setOpen,
  onChange,
  value,
}: UseCategoryNavigationProps) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing) return;

      setOpen(true);

      if (e.key === "ArrowUp") {
        moveCursor(-1);
        return;
      }

      if (e.key === "ArrowDown") {
        moveCursor(+1);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();

        if (!categories || categories.length === 0) return;

        const index = categories.findIndex((item) =>
          item.name.startsWith(query),
        );
        const next = (index + 1) % categories.length;
        const selected = categories[next];

        onChange(selected);
        setQuery(selected.name);

        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const current = categories?.[cursor];
        if (!current) return;
        if (current !== value) onChange(current);
        setQuery(current.name);
        setOpen(false);
        return;
      }
    },
    [categories, cursor, moveCursor, onChange, query, setOpen, setQuery, value],
  );

  const handleSelectCategory = useCallback(
    (category: Category) => {
      setQuery(category.name);
      setOpen(false);
      onChange(category);
    },
    [onChange, setOpen, setQuery],
  );

  return {
    handleKeyDown,
    handleSelectCategory,
  };
};
