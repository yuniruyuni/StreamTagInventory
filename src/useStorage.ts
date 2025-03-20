import { type Dispatch, useCallback, useEffect, useState } from "react";

export const genUseStorage = <T>(
  storage: Storage,
  key: string,
  def: T,
): [T, Dispatch<T>] => {
  const [state, setState] = useState<T>(def);

  useEffect(() => {
    const loaded = storage.getItem(key);
    if (loaded == null) return;

    try {
      const parsed = JSON.parse(loaded);
      if (!parsed) {
        storage.removeItem(key);
        return;
      }
      setState(parsed);
    } catch (e) {
      // 無効なJSONの場合は、セッションストレージから削除
      storage.removeItem(key);
      return;
    }
  }, [storage, key]);

  const setStorage = useCallback(
    (updated: T) => {
      const json = JSON.stringify(updated);
      storage.setItem(key, json);
      setState(updated);
    },
    [storage, key],
  );

  return [state, setStorage];
};

export const useSession = <T>(key: string, def: T): [T, Dispatch<T>] =>
  genUseStorage(sessionStorage, key, def);
export const useStorage = <T>(key: string, def: T): [T, Dispatch<T>] =>
  genUseStorage(localStorage, key, def);
