import { type Dispatch, useCallback, useEffect, useState } from "react";

export const genUseStorage = <T>(
  storage: Storage,
  key: string,
  def: T,
): [T, Dispatch<T>, () => void] => {
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
    } catch (_e) {
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

  const removeStorage = useCallback(() => {
    storage.removeItem(key);
    setState(def);
  }, [storage, key, def]);

  return [state, setStorage, removeStorage];
};

export const useSession = <T>(
  key: string,
  def: T,
): [T, Dispatch<T>, () => void] => genUseStorage(sessionStorage, key, def);
export const useStorage = <T>(
  key: string,
  def: T,
): [T, Dispatch<T>, () => void] => genUseStorage(localStorage, key, def);
