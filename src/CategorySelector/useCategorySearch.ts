import { useContext, useState } from "react";
import useSWR from "swr";
import { dep, twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
import type { Category } from "~/model/category";
import { TwitchAuthContext } from "~/TwitchAuth";

type UseCategorySearchProps = {
  initialCategory?: Category;
  onCategoryFound: (category: Category) => void;
  onCursorReset: () => void;
  onCursorSet: (index: number) => void;
};

type UseCategorySearchResult = {
  query: string;
  setQuery: (query: string) => void;
  categories?: Category[];
};

export const useCategorySearch = ({
  initialCategory,
  onCategoryFound,
  onCursorReset,
  onCursorSet,
}: UseCategorySearchProps): UseCategorySearchResult => {
  const { i18n } = useTranslation();
  const { token } = useContext(TwitchAuthContext);
  const [query, setQuery] = useState(initialCategory?.name ?? "");

  const { data: categories } = useSWR(
    () => [
      dep`https://api.twitch.tv/helix/search/categories?query=${
        query !== "" ? query : undefined
      }`,
      token,
      i18n.language,
    ],
    twitch.get<Category[]>,
    {
      onSuccess: (categories) => {
        onCursorReset();

        const foundIndex = categories.findIndex((item) => item.name === query);
        if (foundIndex === -1) return;
        const found = categories[foundIndex];
        onCursorSet(foundIndex);
        onCategoryFound(found);
      },
    },
  );

  return {
    query,
    setQuery,
    categories,
  };
};
