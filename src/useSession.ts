import { type Dispatch, useCallback, useEffect, useState } from "react";

export const useSession = <T>(key: string, def: T): [T, Dispatch<T>] => {
  const [storage, setState] = useState<T>(def);

  useEffect(() => {
    const loaded = sessionStorage.getItem(key);
    if (loaded == null) return;

    try {
      const parsed = JSON.parse(loaded);
      if (!parsed) {
        sessionStorage.removeItem(key);
        return;
      }
      setState(parsed);
    } catch (e) {
      // 無効なJSONの場合は、セッションストレージから削除
      sessionStorage.removeItem(key);
      return;
    }
  }, [key]);

  const setStorage = useCallback(
    (updated: T) => {
      const json = JSON.stringify(updated);
      sessionStorage.setItem(key, json);
      setState(updated);
    },
    [key],
  );

  return [storage, setStorage];
};
