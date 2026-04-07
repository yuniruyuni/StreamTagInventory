import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { genUseStorage } from "./useStorage";

class MockStorage implements Storage {
  store: Map<string, string> = new Map();

  getItem(key: string) {
    return this.store.get(key) || null;
  }
  setItem(key: string, value: string) {
    return this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store = new Map();
  }
  key(_index: number) {
    return null;
  }
  get length() {
    return this.store.size;
  }
}

test("初期値が正しく設定される", () => {
  const storage = new MockStorage();
  const { result } = renderHook(() =>
    genUseStorage(storage, "testKey", "initialValue"),
  );
  const [value] = result.current;
  expect(value).toBe("initialValue");
});

test("ローカルストレージに保存されている値を読み込む", () => {
  const storage = new MockStorage();
  // 事前にlocalStorageに値を設定
  storage.setItem("testKey", JSON.stringify("storedValue"));

  const { result } = renderHook(() =>
    genUseStorage(storage, "testKey", "initialValue"),
  );
  const [value] = result.current;
  expect(value).toBe("storedValue");
});

test("setStorage関数でデータを更新できる", () => {
  const storage = new MockStorage();
  const { result } = renderHook(() =>
    genUseStorage(storage, "testKey", "initialValue"),
  );

  // setStorage関数を呼び出し
  act(() => {
    const [, setStorage] = result.current;
    setStorage("updatedValue");
  });

  // 値が更新されていることを確認
  const [value] = result.current;
  expect(value).toBe("updatedValue");

  // localStorageに保存されていることを確認
  expect(JSON.parse(storage.getItem("testKey") || "")).toBe("updatedValue");
});

test("キーが変更された場合に新しいキーの値を読み込む", () => {
  const storage = new MockStorage();
  // 事前に異なるキーに値を設定
  storage.setItem("key1", JSON.stringify("value1"));
  storage.setItem("key2", JSON.stringify("value2"));

  // key1で初期化
  const { result, rerender } = renderHook(
    ({ key, defaultValue }) => genUseStorage(storage, key, defaultValue),
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

test("無効なJSONがstorageにある場合は初期値が使用される", () => {
  const storage = new MockStorage();
  // 無効なJSONを設定
  storage.setItem("testKey", "invalid-json");

  const { result } = renderHook(() =>
    genUseStorage(storage, "testKey", "initialValue"),
  );
  const [value] = result.current;

  // 初期値が使用されていることを確認
  expect(value).toBe("initialValue");
});

test("storageがnullを返す場合は初期値が使用される", () => {
  const storage = new MockStorage();
  // storageに値を設定しない

  const { result } = renderHook(() =>
    genUseStorage(storage, "testKey", "initialValue"),
  );
  const [value] = result.current;

  // 初期値が使用されていることを確認
  expect(value).toBe("initialValue");
});

test("複雑なオブジェクトも保存と取得ができる", () => {
  const storage = new MockStorage();
  const complexObject = { a: 1, b: "test", c: [1, 2, 3], d: { nested: true } };

  const { result } = renderHook(() =>
    genUseStorage(storage, "complexKey", complexObject),
  );

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

  // storageに保存された値が正しいことを確認
  expect(JSON.parse(storage.getItem("complexKey") || "")).toEqual(
    updatedObject,
  );
});
