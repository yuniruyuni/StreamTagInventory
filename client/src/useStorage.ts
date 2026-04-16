import { type Dispatch, useCallback, useEffect, useState } from "react";

const readStorage = <T>(storage: Storage, key: string): T | undefined => {
  const raw = storage.getItem(key);
  if (raw == null) return undefined;

  try {
    const parsed = JSON.parse(raw);
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
): [T, Dispatch<T>, () => void] => {
  // lazy init で初回レンダリングから storage の値を同期的に反映し、
  // hydration flash (初期値 → storage 値のちらつき) を防ぐ。
  const [state, setState] = useState<T>(
    () => readStorage<T>(storage, key) ?? def,
  );

  // key / storage が変わった時は読み直す。
  // def は呼び出し側で毎レンダー新しい参照になる可能性があるため依存から除外
  // (依存に含めると空配列リテラル等で無限ループになる)。
  // storage に値がない場合は前回値を保持する (旧実装と同挙動)。
  useEffect(() => {
    const value = readStorage<T>(storage, key);
    if (value !== undefined) setState(value);
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
