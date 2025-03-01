import { afterEach, beforeEach, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { setupTestEnvironment } from "./test-utils";
import { useStorage } from "./useStorage";

// テスト環境のセットアップ
setupTestEnvironment();

// モックのlocalStorageを作成
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// テスト前にlocalStorageをモックに置き換え
beforeEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト環境のセットアップに必要
  (global as any).localStorage = mockLocalStorage;
  mockLocalStorage.clear();
});

// テスト後にモックをクリア
afterEach(() => {
  mockLocalStorage.clear();
});

test("初期値が正しく設定される", () => {
  const { result } = renderHook(() => useStorage("testKey", "initialValue"));
  const [value] = result.current;
  expect(value).toBe("initialValue");
});

test("ローカルストレージに保存されている値を読み込む", () => {
  // 事前にlocalStorageに値を設定
  localStorage.setItem("testKey", JSON.stringify("storedValue"));

  const { result } = renderHook(() => useStorage("testKey", "initialValue"));
  const [value] = result.current;
  expect(value).toBe("storedValue");
});

test("setStorage関数でデータを更新できる", () => {
  const { result } = renderHook(() => useStorage("testKey", "initialValue"));

  // setStorage関数を呼び出し
  act(() => {
    const [, setStorage] = result.current;
    setStorage("updatedValue");
  });

  // 値が更新されていることを確認
  const [value] = result.current;
  expect(value).toBe("updatedValue");

  // localStorageに保存されていることを確認
  expect(JSON.parse(localStorage.getItem("testKey") || "")).toBe(
    "updatedValue",
  );
});

test("キーが変更された場合に新しいキーの値を読み込む", () => {
  // 事前に異なるキーに値を設定
  localStorage.setItem("key1", JSON.stringify("value1"));
  localStorage.setItem("key2", JSON.stringify("value2"));

  // key1で初期化
  const { result, rerender } = renderHook(
    ({ key, defaultValue }) => useStorage(key, defaultValue),
    {
      initialProps: { key: "key1", defaultValue: "default1" },
    },
  );

  // key1の値が読み込まれていることを確認
  expect(result.current[0]).toBe("value1");

  // key2に変更
  rerender({ key: "key2", defaultValue: "default2" });

  // key2の値が読み込まれていることを確認
  expect(result.current[0]).toBe("value2");
});

test("無効なJSONがlocalStorageにある場合は初期値が使用される", () => {
  // 無効なJSONを設定
  localStorage.setItem("testKey", "invalid-json");

  const { result } = renderHook(() => useStorage("testKey", "initialValue"));
  const [value] = result.current;

  // 初期値が使用されていることを確認
  expect(value).toBe("initialValue");
});

test("localStorageがnullを返す場合は初期値が使用される", () => {
  // localStorageに値を設定しない

  const { result } = renderHook(() => useStorage("testKey", "initialValue"));
  const [value] = result.current;

  // 初期値が使用されていることを確認
  expect(value).toBe("initialValue");
});

test("複雑なオブジェクトも保存と取得ができる", () => {
  const complexObject = { a: 1, b: "test", c: [1, 2, 3], d: { nested: true } };

  const { result } = renderHook(() => useStorage("complexKey", complexObject));

  // 初期値が正しいことを確認
  expect(result.current[0]).toEqual(complexObject);

  // 値を更新
  const updatedObject = { ...complexObject, e: "new" };
  act(() => {
    const [, setStorage] = result.current;
    setStorage(updatedObject);
  });

  // 更新された値が正しいことを確認
  expect(result.current[0]).toEqual(updatedObject);

  // localStorageに保存された値が正しいことを確認
  expect(JSON.parse(localStorage.getItem("complexKey") || "")).toEqual(
    updatedObject,
  );
});
