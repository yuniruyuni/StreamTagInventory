import clsx from "clsx";
import { type FC, memo, useCallback } from "react";
import { SearchCombobox } from "~/components/SearchCombobox";
import { useTranslation } from "~/i18n";
import type { Category } from "~/model/category";
import { useCategorySearch } from "./useCategorySearch";

type Props = {
  id?: string;
  value?: Category;
  onChange: (category: Category) => void;
};

const getItemId = (item: Category) => item.id;
const getItemName = (item: Category) => item.name;

const renderItem = (item: Category, isSelected: boolean) => (
  <span
    className={clsx("flex items-center gap-2", isSelected && "bg-slate-100")}
  >
    {item.box_art_url && (
      <img
        src={item.box_art_url
          .replace("{width}", "52")
          .replace("{height}", "72")}
        alt={item.name}
      />
    )}
    {item.name}
  </span>
);

const renderSelected = (value: Category | undefined) =>
  value?.box_art_url ? (
    <img
      src={value.box_art_url.replace("{width}", "52").replace("{height}", "72")}
      alt={value.name}
    />
  ) : null;

export const CategorySelector: FC<Props> = memo(({ id, value, onChange }) => {
  const { t } = useTranslation();

  const { query, setQuery, categories } = useCategorySearch({
    initialCategory: value,
    onCategoryFound: onChange,
  });

  const handleQueryChange = useCallback((q: string) => setQuery(q), [setQuery]);

  return (
    <SearchCombobox<Category>
      items={categories}
      value={value}
      query={query}
      onQueryChange={handleQueryChange}
      onSelect={onChange}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      renderSelected={renderSelected}
      placeholder={t("template.pickCategory")}
      emptyLabel={t("template.noResults")}
      id={id}
    />
  );
});
