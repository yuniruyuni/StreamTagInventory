import clsx from "clsx";
import React, { type FC } from "react";
import useSWR from "swr";

import { TwitchAuthContext } from "~/TwitchAuth";
import { dep, twitch } from "~/fetcher";
import type { Category } from "~/model/category";
import { CategoryInput } from "./CategoryInput";
import { CategoryList } from "./CategoryList";

type Props = {
  value?: Category;
  onChange: (category: Category) => void;
};

export const CategorySelector: FC<Props> = ({ value, onChange }) => {
  const { token } = React.useContext(TwitchAuthContext);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value?.name ?? "");
  const [cursor, setCursor] = React.useState(0);

  const { data: categories } = useSWR(
    () => [
      dep`https://api.twitch.tv/helix/search/categories?query=${query !== "" ? query : undefined}`,
      token,
    ],
    twitch.get<Category[]>,
    {
      onSuccess: (categories) => {
        setCursor(0);

        const foundIndex = categories.findIndex((item) => item.name === query);
        if (foundIndex === -1) return;
        const found = categories[foundIndex];
        setCursor(foundIndex);
        onChange(found);
      },
    },
  );

  const moveCursor = React.useCallback(
    (diff: number) => {
      if (!categories || categories.length === 0) {
        setCursor(0);
        return;
      }

      let next = cursor;
      next += diff;
      next %= categories.length;
      if (next < 0) next = categories.length + next;
      setCursor(next);
    },
    [cursor, categories],
  );

  const handleKeyDown = React.useCallback(
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
    [categories, cursor, moveCursor, onChange, query, value],
  );

  const handleSelectCategory = React.useCallback(
    (category: Category) => {
      setQuery(category.name);
      setOpen(false);
      onChange(category);
    },
    [onChange],
  );

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
