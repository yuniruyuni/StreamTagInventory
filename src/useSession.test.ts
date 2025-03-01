import { afterEach, beforeEach, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { setupTestEnvironment } from "./test-utils";
import { useSession } from "./useSession";

// テスト環境のセットアップ
setupTestEnvironment();

// モックのsessionStorageを作成
const mockSessionStorage = (() => {
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

// テスト前にsessionStorageをモックに置き換え
beforeEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト環境のセットアップに必要
  (global as any).sessionStorage = mockSessionStorage;
  mockSessionStorage.clear();
});

// テスト後にモックをクリア
afterEach(() => {
  mockSessionStorage.clear();
});

test("初期値が正しく設定される", () => {
  const { result } = renderHook(() => useSession("testKey", "initialValue"));
  const [value] = result.current;
  expect(value).toBe("initialValue");
});

test("セッションストレージに保存されている値を読み込む", () => {
  // 事前にsessionStorageに値を設定
  sessionStorage.setItem("testKey", JSON.stringify("storedValue"));

  const { result } = renderHook(() => useSession("testKey", "initialValue"));
  const [value] = result.current;
  expect(value).toBe("storedValue");
});

test("setStorage関数でデータを更新できる", () => {
  const { result } = renderHook(() => useSession("testKey", "initialValue"));

  // setStorage関数を呼び出し
  act(() => {
    const [, setStorage] = result.current;
    setStorage("updatedValue");
  });

  // 値が更新されていることを確認
  const [value] = result.current;
  expect(value).toBe("updatedValue");

  // sessionStorageに保存されていることを確認
  expect(JSON.parse(sessionStorage.getItem("testKey") || "")).toBe(
    "updatedValue",
  );
});

test("キーが変更された場合に新しいキーの値を読み込む", () => {
  // 事前に異なるキーに値を設定
  sessionStorage.setItem("key1", JSON.stringify("value1"));
  sessionStorage.setItem("key2", JSON.stringify("value2"));

  // key1で初期化
  const { result, rerender } = renderHook(
    ({ key, defaultValue }) => useSession(key, defaultValue),
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

test("無効なJSONがsessionStorageにある場合は初期値が使用される", () => {
  // 無効なJSONを設定
  sessionStorage.setItem("testKey", "invalid-json");

  const { result } = renderHook(() => useSession("testKey", "initialValue"));
  const [value] = result.current;

  // 初期値が使用されていることを確認
  expect(value).toBe("initialValue");
});

test("sessionStorageがnullを返す場合は初期値が使用される", () => {
  // sessionStorageに値を設定しない

  const { result } = renderHook(() => useSession("testKey", "initialValue"));
  const [value] = result.current;

  // 初期値が使用されていることを確認
  expect(value).toBe("initialValue");
});

test("複雑なオブジェクトも保存と取得ができる", () => {
  const complexObject = { a: 1, b: "test", c: [1, 2, 3], d: { nested: true } };

  const { result } = renderHook(() => useSession("complexKey", complexObject));

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

  // sessionStorageに保存された値が正しいことを確認
  expect(JSON.parse(sessionStorage.getItem("complexKey") || "")).toEqual(
    updatedObject,
  );
});
