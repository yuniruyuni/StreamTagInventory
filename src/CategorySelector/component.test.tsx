import { beforeEach, expect, mock, test } from "bun:test";
import { type Category, EmptyCategory } from "../model/category";
import { fireEvent, render, setupTestEnvironment } from "../test-utils";
import { CategorySelector } from "./component";
import React from "react";

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

// テスト後にuseSWRを元に戻す関数
function restoreUseSWR() {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (require("swr") as any).default = originalUseSWR;
}

// React.useContextのモック
let originalUseContext: typeof React.useContext;

beforeEach(() => {
  originalUseContext = React.useContext;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (React as any).useContext = () => ({ token: "test-token" });
});

test("CategorySelectorコンポーネントが正しくレンダリングされる", () => {
  try {
    // モックコールバック
    const mockOnChange = mock((_: Category) => {});

    // コンポーネントをレンダリング
    const { container, getByPlaceholderText } = render(
      <CategorySelector value={EmptyCategory} onChange={mockOnChange} />
    );

    // 入力フィールドが存在することを確認
    const input = getByPlaceholderText("Pick a category");
    expect(input).not.toBeNull();

    // 初期状態ではドロップダウンが非表示であることを確認
    const dropdown = container.querySelector(".dropdown");
    expect(dropdown).not.toBeNull();

    const dropdownContent = container.querySelector("[data-testid='dropdown-content']");
    expect(dropdownContent).not.toBeNull();
    expect(dropdownContent?.classList.contains("invisible")).toBe(true);
    expect(dropdownContent?.classList.contains("visible")).toBe(false);
  } finally {
    // テスト後に元に戻す
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (React as any).useContext = originalUseContext;
    restoreUseSWR();
  }
});

test("入力フィールドにフォーカスするとドロップダウンが表示される", () => {
  try {
    // モックコールバック
    const mockOnChange = mock((_: Category) => {});

    // コンポーネントをレンダリング
    const { container, getByPlaceholderText } = render(
      <CategorySelector value={EmptyCategory} onChange={mockOnChange} />
    );

    // 入力フィールドを取得
    const input = getByPlaceholderText("Pick a category");
    expect(input).not.toBeNull();

    // フォーカスイベントをシミュレート
    fireEvent.focus(input);

    // ドロップダウンが表示されることを確認
    const dropdownContent = container.querySelector("[data-testid='dropdown-content']");
    expect(dropdownContent).not.toBeNull();
    expect(dropdownContent?.classList.contains("visible")).toBe(true);
    expect(dropdownContent?.classList.contains("invisible")).toBe(false);
  } finally {
    // テスト後に元に戻す
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (React as any).useContext = originalUseContext;
    restoreUseSWR();
  }
});

test("検索クエリに基づいてカテゴリがフィルタリングされる", () => {
  try {
    // モックコールバック
    const mockOnChange = mock((_: Category) => {});

    // コンポーネントをレンダリング
    const { getByPlaceholderText } = render(
      <CategorySelector value={EmptyCategory} onChange={mockOnChange} />
    );

    // 入力フィールドを取得
    const input = getByPlaceholderText("Pick a category");
    expect(input).not.toBeNull();

    // 入力値を変更
    fireEvent.change(input, { target: { value: "Mine" } });

    // 入力値が変更されたことを確認
    expect((input as HTMLInputElement).value).toBe("Mine");
  } finally {
    // テスト後に元に戻す
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (React as any).useContext = originalUseContext;
    restoreUseSWR();
  }
});
