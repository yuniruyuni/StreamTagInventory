import React, { useEffect, useRef } from "react";
import { MenuList } from "~/components/MenuList";

type ComboboxListProps<T> = {
  items: T[];
  cursor: number;
  setCursor: (index: number) => void;
  onSelect: (index: number) => void;
  getItemId: (item: T) => string;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  emptyLabel?: string;
};

const ComboboxListInner = <T,>({
  items,
  cursor,
  setCursor,
  onSelect,
  getItemId,
  renderItem,
  emptyLabel,
}: ComboboxListProps<T>) => {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!ref.current || items.length === 0) return;
    ref.current.children[cursor]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [cursor, items]);

  return (
    <MenuList
      ref={ref}
      className="w-full max-h-80 py-0 p-2 flex-nowrap overflow-auto"
    >
      {items.length === 0 && emptyLabel && (
        <li className="px-4 py-3 text-sm text-slate-500">{emptyLabel}</li>
      )}
      {items.map((item, index) => (
        <li key={getItemId(item)}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(index);
            }}
            onMouseEnter={() => setCursor(index)}
          >
            {renderItem(item, index === cursor)}
          </button>
        </li>
      ))}
    </MenuList>
  );
};

export const ComboboxList = React.memo(
  ComboboxListInner,
) as typeof ComboboxListInner;
