/**
 * hydration flash (初期値 → storage 値のちらつき) が発生しないことを検証する
 * リグレッションテスト。
 *
 * 旧実装では useState(def) → useEffect で setState の 2 段階レンダリングで
 * ちらつきが起きていた。lazy init により初回レンダリングから storage の値が
 * 同期的に反映されることを保証する。
 */

import { describe, expect, test } from "bun:test";
import { render, renderHook } from "@testing-library/react";
import React from "react";
import { genUseStorage } from "./useStorage";

class MockStorage implements Storage {
  store: Map<string, string> = new Map();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(_index: number) {
    return null;
  }
  get length() {
    return this.store.size;
  }
}

describe("hydration flash が発生しないこと", () => {
  test("[hook] storage に値がある場合、初回レンダリングから storage 値が返る", () => {
    const storage = new MockStorage();
    storage.setItem("templates", JSON.stringify(["saved-template"]));

    const renders: string[][] = [];
    renderHook(() => {
      const [value] = genUseStorage<string[]>(storage, "templates", []);
      renders.push([...value]);
      return value;
    });

    // すべてのレンダリングで storage 値が返る (def が一度も見えない)
    for (const r of renders) {
      expect(r).toEqual(["saved-template"]);
    }
  });

  test("[DOM] 初回 DOM に storage 値がそのまま描画される", () => {
    const storage = new MockStorage();
    storage.setItem("templates", JSON.stringify(["A", "B", "C"]));

    const snapshots: string[] = [];

    const Screen: React.FC = () => {
      const [items] = genUseStorage<string[]>(storage, "templates", []);
      snapshots.push(items.join(","));
      return React.createElement(
        "ul",
        null,
        items.map((x) => React.createElement("li", { key: x }, x)),
      );
    };

    const { container } = render(React.createElement(Screen));

    // 初回レンダリングから正しい値
    expect(snapshots[0]).toBe("A,B,C");
    expect(container.querySelectorAll("li").length).toBe(3);
  });

  test("[hook] storage が空の場合は def が返る (フラッシュ無し)", () => {
    const storage = new MockStorage();

    const renders: string[][] = [];
    renderHook(() => {
      const [value] = genUseStorage<string[]>(storage, "templates", []);
      renders.push([...value]);
      return value;
    });

    // 全てのレンダリングで def ([])
    for (const r of renders) {
      expect(r).toEqual([]);
    }
  });
});
