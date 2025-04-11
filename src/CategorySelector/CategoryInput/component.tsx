import clsx from "clsx";
import type React from "react";
import { useTranslation } from "~/i18n";
import type { Category } from "~/model/category";

type Props = {
  value?: Category;
  query: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange: (category: Category) => void;
  categories?: Category[];
};

export const CategoryInput: React.FC<Props> = ({
  value,
  query,
  open,
  setOpen,
  setQuery,
  onKeyDown,
  onChange,
  categories,
}) => {
  const { t } = useTranslation();

  return (
    <label className="relative w-full h-24">
      <div
        data-testid="thumbnail"
        className="absolute z-20 inset-y-0 start-0 flex items-center ps-3 pointer-events-none "
      >
        {value && <img src={value.box_art_url} alt={value.name} />}
      </div>

      <input
        id="category"
        type="text"
        placeholder={t("template.pickCategory")}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery(value?.name ?? "");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          const found = categories?.find(
            (item) => item.name === e.target.value,
          );
          if (!found) return;
          onChange(found);
        }}
        onKeyDown={onKeyDown}
        className={clsx(
          "relative z-10",
          "w-full h-24 ps-24",
          "input input-bordered form-input",
          "focus:outline-none",
          open && "border-b-0 rounded-b-none",
        )}
      />
    </label>
  );
};
