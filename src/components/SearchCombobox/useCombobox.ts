import { useCallback, useState } from "react";

type UseComboboxProps<T> = {
  items: T[] | undefined;
  value: T | undefined;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (item: T) => void;
  getItemId: (item: T) => string;
  getItemName: (item: T) => string;
};

type UseComboboxResult = {
  open: boolean;
  cursor: number;
  setCursor: (index: number) => void;
  handleFocus: () => void;
  handleBlur: () => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSelect: (index: number) => void;
};

export const useCombobox = <T>({
  items,
  value,
  query,
  onQueryChange,
  onSelect,
  getItemId,
  getItemName,
}: UseComboboxProps<T>): UseComboboxResult => {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const moveCursor = useCallback(
    (diff: number) => {
      const len = items?.length ?? 0;
      if (len === 0) {
        setCursor(0);
        return;
      }
      setCursor((prev) => {
        let next = (prev + diff) % len;
        if (next < 0) next = len + next;
        return next;
      });
    },
    [items],
  );

  const selectItem = useCallback(
    (item: T) => {
      onQueryChange(getItemName(item));
      setOpen(false);
      onSelect(item);
    },
    [onQueryChange, onSelect, getItemName],
  );

  const handleFocus = useCallback(() => {
    setOpen(true);
  }, []);

  const handleBlur = useCallback(() => {
    setOpen(false);
    onQueryChange(value ? getItemName(value) : "");
  }, [onQueryChange, value, getItemName]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onQueryChange(e.target.value);
      const found = items?.find((item) => getItemName(item) === e.target.value);
      if (found) onSelect(found);
    },
    [onQueryChange, items, onSelect, getItemName],
  );

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
        if (!items || items.length === 0) return;

        const index = items.findIndex((item) =>
          getItemName(item).startsWith(query),
        );
        const next = (index + 1) % items.length;
        selectItem(items[next]);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const current = items?.[cursor];
        if (!current) return;
        if (!value || getItemId(current) !== getItemId(value)) {
          onSelect(current);
        }
        onQueryChange(getItemName(current));
        setOpen(false);
        return;
      }
    },
    [
      items,
      cursor,
      moveCursor,
      onSelect,
      query,
      selectItem,
      value,
      getItemId,
      getItemName,
      onQueryChange,
    ],
  );

  const handleSelect = useCallback(
    (index: number) => {
      const item = items?.[index];
      if (item) selectItem(item);
    },
    [items, selectItem],
  );

  return {
    open,
    cursor,
    setCursor,
    handleFocus,
    handleBlur,
    handleInputChange,
    handleKeyDown,
    handleSelect,
  };
};
