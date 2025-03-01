import { useCallback, useContext, useState } from "react";
import useSWR from "swr";

import { TwitchAuthContext } from "~/TwitchAuth";
import { dep, twitch } from "~/fetcher";
import type { Category } from "~/model/category";

type UseCategorySearchProps = {
  initialCategory?: Category;
  onCategoryFound: (category: Category) => void;
};

type UseCategorySearchResult = {
  query: string;
  setQuery: (query: string) => void;
  categories?: Category[];
  cursor: number;
  setCursor: (index: number) => void;
  moveCursor: (diff: number) => void;
};

export const useCategorySearch = ({
  initialCategory,
  onCategoryFound,
}: UseCategorySearchProps): UseCategorySearchResult => {
  const { token } = useContext(TwitchAuthContext);
  const [query, setQuery] = useState(initialCategory?.name ?? "");
  const [cursor, setCursor] = useState(0);

  const { data: categories } = useSWR(
    () => [
      dep`https://api.twitch.tv/helix/search/categories?query=${
        query !== "" ? query : undefined
      }`,
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
        onCategoryFound(found);
      },
    },
  );

  const moveCursor = useCallback(
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

  return {
    query,
    setQuery,
    categories,
    cursor,
    setCursor,
    moveCursor,
  };
};
