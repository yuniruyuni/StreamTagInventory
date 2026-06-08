import clsx from "clsx";
import type React from "react";
import { memo, useId } from "react";
import { Input } from "~/components/Input";
import { ComboboxList } from "./ComboboxList";
import { useCombobox } from "./useCombobox";

export type SearchComboboxProps<T> = {
  items: T[] | undefined;
  value: T | undefined;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (item: T) => void;
  getItemId: (item: T) => string;
  getItemName: (item: T) => string;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  renderSelected?: (value: T | undefined) => React.ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  emptyLabel?: string;
};

const SearchComboboxInner = <T,>({
  items,
  value,
  query,
  onQueryChange,
  onSelect,
  getItemId,
  getItemName,
  renderItem,
  renderSelected,
  placeholder,
  className,
  inputClassName,
  id,
  emptyLabel,
}: SearchComboboxProps<T>) => {
  const {
    open,
    cursor,
    setCursor,
    handleFocus,
    handleBlur,
    handleInputChange,
    handleKeyDown,
    handleSelect,
  } = useCombobox({
    items,
    value,
    query,
    onQueryChange,
    onSelect,
    getItemId,
    getItemName,
  });

  const hasResults = items !== undefined && items.length > 0;
  const showEmpty = items !== undefined && items.length === 0 && query !== "";
  const showDropdown = open && (hasResults || showEmpty);
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className={clsx("relative", className)}>
      <label htmlFor={inputId} className="relative w-full h-24">
        {renderSelected && (
          <div className="absolute z-20 inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
            {renderSelected(value)}
          </div>
        )}

        <Input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className={clsx(
            "relative z-10",
            "w-full h-24",
            renderSelected && "ps-24",
            "focus:border-slate-900",
            showDropdown && "border-b-0 rounded-b-none",
            inputClassName,
          )}
          style={showDropdown ? { boxShadow: "none" } : undefined}
        />
      </label>

      {showDropdown && (
        <div
          role="listbox"
          className={clsx(
            "absolute top-full left-0 z-20",
            "w-full h-fit",
            "border border-t-0 border-slate-900",
            "bg-white",
            "rounded-b",
          )}
        >
          <ComboboxList
            items={items}
            cursor={cursor}
            setCursor={setCursor}
            onSelect={handleSelect}
            getItemId={getItemId}
            renderItem={renderItem}
            emptyLabel={emptyLabel}
          />
        </div>
      )}
    </div>
  );
};

export const SearchCombobox = memo(
  SearchComboboxInner,
) as typeof SearchComboboxInner;
