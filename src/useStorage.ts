import {
  type Dispatch,
  useCallback,
  useEffect,
  useState,
} from "react";


export const useStorage = <T,>(key: string, def: T): [T, Dispatch<T>] => {
  const [storage, setState] = useState<T>(def);

  useEffect(() => {
    const loaded = localStorage.getItem(key);
    if (loaded == null) return;
    const parsed = JSON.parse(loaded);
    if (!parsed) {
      localStorage.removeItem(key);
      return;
    }
    setState(parsed);
  }, [key]);

  const setStorage = useCallback(
    (updated: T) => {
      const json = JSON.stringify(updated);
      localStorage.setItem(key, json);
      setState(updated);
    },
    [key],
  );

  return [storage, setStorage];
};
