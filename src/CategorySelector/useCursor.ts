import { useCallback, useState } from "react";

type UseCursorResult = {
  cursor: number;
  setCursor: (index: number) => void;
  moveCursor: (diff: number, listLength: number) => void;
  resetCursor: () => void;
};

export const useCursor = (): UseCursorResult => {
  const [cursor, setCursor] = useState(0);

  const moveCursor = useCallback((diff: number, listLength: number) => {
    if (listLength === 0) {
      setCursor(0);
      return;
    }

    setCursor((prev) => {
      let next = prev + diff;
      next %= listLength;
      if (next < 0) next = listLength + next;
      return next;
    });
  }, []);

  const resetCursor = useCallback(() => {
    setCursor(0);
  }, []);

  return { cursor, setCursor, moveCursor, resetCursor };
};
