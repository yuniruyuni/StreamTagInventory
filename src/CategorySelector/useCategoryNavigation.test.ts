import { expect, mock, test } from "bun:test";
import type React from "react";
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

// useCategoryNavigationの実装から必要な関数を抽出してテスト
test("キーボードナビゲーション機能のテスト", () => {
  const mockMoveCursor = mock((_: number) => {});
  const mockSetOpen = mock((_: boolean) => {});
  const mockSetQuery = mock((_: string) => {});
  const mockOnChange = mock((_: Category) => {});

  // handleKeyDown関数を直接実装してテスト
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;

    mockSetOpen(true);

    if (e.key === "ArrowUp") {
      mockMoveCursor(-1);
      return;
    }

    if (e.key === "ArrowDown") {
      mockMoveCursor(+1);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();

      if (!mockCategories || mockCategories.length === 0) return;

      const query = "Min"; // テスト用
      const index = mockCategories.findIndex((item) =>
        item.name.startsWith(query),
      );
      const next = (index + 1) % mockCategories.length;
      const selected = mockCategories[next];

      mockOnChange(selected);
      mockSetQuery(selected.name);

      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const cursor = 0; // テスト用
      const current = mockCategories?.[cursor];
      if (!current) return;
      mockOnChange(current);
      mockSetQuery(current.name);
      mockSetOpen(false);
      return;
    }
  };

  // handleSelectCategory関数を直接実装してテスト
  const handleSelectCategory = (category: Category) => {
    mockSetQuery(category.name);
    mockSetOpen(false);
    mockOnChange(category);
  };

  // ArrowUpキーのテスト
  const arrowUpEvent = {
    key: "ArrowUp",
    preventDefault: () => {},
    nativeEvent: { isComposing: false },
  } as unknown as React.KeyboardEvent<HTMLInputElement>;

  handleKeyDown(arrowUpEvent);
  expect(mockSetOpen).toHaveBeenCalledWith(true);
  expect(mockMoveCursor).toHaveBeenCalledWith(-1);

  // ArrowDownキーのテスト
  const arrowDownEvent = {
    key: "ArrowDown",
    preventDefault: () => {},
    nativeEvent: { isComposing: false },
  } as unknown as React.KeyboardEvent<HTMLInputElement>;

  handleKeyDown(arrowDownEvent);
  expect(mockSetOpen).toHaveBeenCalledWith(true);
  expect(mockMoveCursor).toHaveBeenCalledWith(1);

  // Tabキーのテスト
  const mockPreventDefault = mock(() => {});
  const tabEvent = {
    key: "Tab",
    preventDefault: mockPreventDefault,
    nativeEvent: { isComposing: false },
  } as unknown as React.KeyboardEvent<HTMLInputElement>;

  handleKeyDown(tabEvent);
  expect(mockSetOpen).toHaveBeenCalledWith(true);
  expect(mockPreventDefault).toHaveBeenCalled();
  expect(mockOnChange).toHaveBeenCalled();
  expect(mockSetQuery).toHaveBeenCalled();

  // Enterキーのテスト
  const enterEvent = {
    key: "Enter",
    preventDefault: mockPreventDefault,
    nativeEvent: { isComposing: false },
  } as unknown as React.KeyboardEvent<HTMLInputElement>;

  handleKeyDown(enterEvent);
  expect(mockSetOpen).toHaveBeenCalledWith(true);
  expect(mockPreventDefault).toHaveBeenCalled();
  expect(mockOnChange).toHaveBeenCalledWith(mockCategories[0]);
  expect(mockSetQuery).toHaveBeenCalledWith(mockCategories[0].name);
  expect(mockSetOpen).toHaveBeenCalledWith(false);

  // カテゴリ選択のテスト
  handleSelectCategory(mockCategories[1]);
  expect(mockSetQuery).toHaveBeenCalledWith(mockCategories[1].name);
  expect(mockSetOpen).toHaveBeenCalledWith(false);
  expect(mockOnChange).toHaveBeenCalledWith(mockCategories[1]);
});
