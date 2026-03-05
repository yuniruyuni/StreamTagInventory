import { useContext, useState } from "react";
import useSWR from "swr";
import { dep, twitch } from "~/fetcher";
import { useTranslation } from "~/i18n";
import type { Category } from "~/model/category";
import { TwitchAuthContext } from "~/TwitchAuth";

type UseCategorySearchProps = {
  initialCategory?: Category;
  onCategoryFound: (category: Category) => void;
};

type UseCategorySearchResult = {
  query: string;
  setQuery: (query: string) => void;
  categories?: Category[];
};

export const useCategorySearch = ({
  initialCategory,
  onCategoryFound,
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
        const found = categories.find((item) => item.name === query);
        if (found) onCategoryFound(found);
      },
    },
  );

  return {
    query,
    setQuery,
    categories,
  };
};
