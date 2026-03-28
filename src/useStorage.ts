import { type Dispatch, useCallback, useEffect, useState } from "react";

type UseStorageResult<T> = [T, Dispatch<T>, () => void, boolean];

const readStorage = <T>(storage: Storage, key: string): T | undefined => {
  const loaded = storage.getItem(key);
  if (loaded == null) return undefined;

  try {
    const parsed = JSON.parse(loaded);
    if (!parsed) {
      storage.removeItem(key);
      return undefined;
    }
    return parsed as T;
  } catch (_e) {
    // 無効なJSONの場合は、ストレージから削除
    storage.removeItem(key);
    return undefined;
  }
};

export const genUseStorage = <T>(
  storage: Storage,
  key: string,
  def: T,
): UseStorageResult<T> => {
  const [state, setState] = useState<T>(
    () => readStorage<T>(storage, key) ?? def,
  );
  const [isHydrated, setIsHydrated] = useState<boolean>(
    () => readStorage(storage, key) !== undefined,
  );

  useEffect(() => {
    const value = readStorage<T>(storage, key);
    if (value !== undefined) {
      setState(value);
      setIsHydrated(true);
    } else {
      setIsHydrated(true);
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

  return [state, setStorage, removeStorage, isHydrated];
};

export const useSession = <T>(key: string, def: T): UseStorageResult<T> =>
  genUseStorage(sessionStorage, key, def);
export const useStorage = <T>(key: string, def: T): UseStorageResult<T> =>
  genUseStorage(localStorage, key, def);
