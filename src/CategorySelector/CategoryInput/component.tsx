import clsx from "clsx";
import type React from "react";
import { Input } from "~/components/Input";
import { useTranslation } from "~/i18n";
import type { Category } from "~/model/category";

type Props = {
  value?: Category;
  query: string;
  open: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export const CategoryInput: React.FC<Props> = ({
  value,
  query,
  open,
  onFocus,
  onBlur,
  onChange,
  onKeyDown,
}) => {
  const { t } = useTranslation();

  return (
    <label htmlFor="category" className="relative w-full h-24">
      <div
        data-testid="thumbnail"
        className="absolute z-20 inset-y-0 start-0 flex items-center ps-3 pointer-events-none "
      >
        {value?.box_art_url && (
          <img
            src={value.box_art_url
              .replace("{width}", "52")
              .replace("{height}", "72")}
            alt={value.name}
          />
        )}
      </div>

      <Input
        id="category"
        type="text"
        placeholder={t("template.pickCategory")}
        value={query}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={clsx(
          "relative z-10",
          "w-full h-24 ps-24",
          "focus:border-on-surface",
          open && "border-b-0 rounded-b-none",
        )}
      />
    </label>
  );
};
