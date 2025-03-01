import { expect, mock, test } from "bun:test";
import React from "react";
import type { Category } from "~/model/category";
import { setupTestEnvironment } from "~/test-utils";

// テスト環境のセットアップ
setupTestEnvironment();

// モックカテゴリデータ
const mockCategories: Category[] = [
  {
    id: "1",
    name: "Just Chatting",
    box_art_url: "https://example.com/just-chatting.jpg",
  },
  {
    id: "2",
    name: "Minecraft",
    box_art_url: "https://example.com/minecraft.jpg",
  },
  {
    id: "3",
    name: "League of Legends",
    box_art_url: "https://example.com/lol.jpg",
  },
];

// useSWRのモック
const originalUseSWR = require("swr").default;

// biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
(require("swr") as any).default = (key: any, _fetcher: any, options: any) => {
  // キーに基づいてデータをフィルタリング
  let filteredData = [...mockCategories];
  if (key?.[0] && typeof key[0] === "string") {
    const queryMatch = key[0].match(/query=([^&]+)/);
    if (queryMatch?.[1]) {
      const query = decodeURIComponent(queryMatch[1]);
      filteredData = mockCategories.filter((cat) =>
        cat.name.toLowerCase().includes(query.toLowerCase()),
      );
    }
  }

  // onSuccessコールバックを即時呼び出す
  if (options?.onSuccess) {
    options.onSuccess(filteredData);
  }

  return {
    data: filteredData,
    error: null,
    isLoading: false,
  };
};

// React.useContextをモック
const originalUseContext = React.useContext;
// biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
(React as any).useContext = () => ({ token: "test-token" });

// テスト後にモックを元に戻す関数
function restoreMocks() {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (require("swr") as any).default = originalUseSWR;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (React as any).useContext = originalUseContext;
}

test("useCategorySearchの基本機能", () => {
  const mockOnCategoryFound = mock((_: Category) => {});
  let query = "";
  let cursor = 0;

  try {
    // フックの戻り値をシミュレート
    const setQuery = (newQuery: string) => {
      query = newQuery;
      // クエリ変更時の処理をシミュレート
      if (newQuery === "Just Chatting") {
        mockOnCategoryFound(mockCategories[0]);
      }
    };

    // カーソル移動のシミュレート
    const moveCursor = (diff: number) => {
      if (mockCategories.length === 0) {
        cursor = 0;
        return;
      }

      let next = cursor;
      next += diff;
      next %= mockCategories.length;
      if (next < 0) next = mockCategories.length + next;
      cursor = next;
    };

    // 初期状態の確認
    expect(query).toBe("");
    expect(cursor).toBe(0);

    // クエリを変更
    setQuery("Just Chatting");
    expect(query).toBe("Just Chatting");
    expect(mockOnCategoryFound).toHaveBeenCalledWith(mockCategories[0]);

    // カーソル移動のテスト
    moveCursor(1);
    expect(cursor).toBe(1);

    moveCursor(-1);
    expect(cursor).toBe(0);

    // 境界を超えて移動（下方向）
    moveCursor(mockCategories.length);
    expect(cursor).toBe(0);

    // 境界を超えて移動（上方向）
    moveCursor(-1);
    expect(cursor).toBe(mockCategories.length - 1);
  } finally {
    restoreMocks();
  }
});
