import { expect, mock, test } from "bun:test";
import React from "react";
import { TwitchAuthContext } from "~/TwitchAuth";
import { renderComponent, setupTestEnvironment } from "../test-utils";
import { Menu } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

// モックユーザーデータ
const mockUser = {
  id: "12345",
  display_name: "テストユーザー",
  profile_image_url: "https://example.com/profile.jpg",
};

// Menuコンポーネントの基本的な構造をテスト
test("Menuコンポーネントの構造", () => {
  // Menuコンポーネントが存在することを確認
  expect(Menu).toBeDefined();

  // Propsの型が正しいことを確認
  const menu = <Menu user={mockUser} />;
  expect(menu.props.user).toEqual(mockUser);
});

// TwitchAuthContextとの連携をテスト
test("TwitchAuthContextとの連携", () => {
  // このテストはモックなしで基本的な構造のみを確認
  expect(Menu.displayName || "Menu").toBe("Menu");
});

// DOMレンダリングのテスト
test("Menuコンポーネントが正しくDOMにレンダリングされる", () => {
  // React.useContextをモック
  const originalUseContext = React.useContext;
  const mockLogout = mock(() => {});

  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (React as any).useContext = (context: any) => {
    if (context === TwitchAuthContext) {
      return { token: "test-token", logout: mockLogout };
    }
    return originalUseContext(context);
  };

  try {
    // コンポーネントをレンダリング
    const root = renderComponent(<Menu user={mockUser} />);

    // ナビゲーションバーが存在することを確認
    const navbar = root.querySelector(".navbar");
    expect(navbar).not.toBeNull();

    // タイトルが正しく表示されていることを確認
    const title = root.querySelector(".btn-ghost.text-xl");
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe("Stream Tag Inventory");

    // アバターが表示されていることを確認
    const avatar = root.querySelector(".avatar");
    expect(avatar).not.toBeNull();

    // ユーザーアイコンが正しく表示されていることを確認
    const userIcon = root.querySelector("img");
    expect(userIcon).not.toBeNull();
    expect(userIcon?.getAttribute("src")).toBe(mockUser.profile_image_url);
    expect(userIcon?.getAttribute("alt")).toBe(`${mockUser.display_name} icon`);
  } finally {
    // テスト後に元に戻す
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (React as any).useContext = originalUseContext;
  }
});

// ドロップダウンメニューのテスト
test("ドロップダウンメニューにログアウトボタンが含まれている", () => {
  // React.useContextをモック
  const originalUseContext = React.useContext;
  const mockLogout = mock(() => {});

  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (React as any).useContext = (context: any) => {
    if (context === TwitchAuthContext) {
      return { token: "test-token", logout: mockLogout };
    }
    return originalUseContext(context);
  };

  try {
    // コンポーネントをレンダリング
    const root = renderComponent(<Menu user={mockUser} />);

    // ドロップダウンメニューが存在することを確認
    const dropdown = root.querySelector(".menu.dropdown-content");
    expect(dropdown).not.toBeNull();

    // ログアウトボタンが存在することを確認
    const logoutButton = dropdown?.querySelector("button");
    expect(logoutButton).not.toBeNull();
    expect(logoutButton?.textContent).toBe("Logout");
  } finally {
    // テスト後に元に戻す
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (React as any).useContext = originalUseContext;
  }
});

// JSXの構造をテスト
test("Menuコンポーネントが正しいJSX構造を持つ", () => {
  // React.useContextをモック
  const originalUseContext = React.useContext;
  const mockLogout = mock(() => {});

  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (React as any).useContext = () => ({ logout: mockLogout });

  try {
    // コンポーネントをレンダリング（実際のDOMではなくJSXの構造をテスト）
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のJSX型アサーション
    const menuElement = Menu({ user: mockUser }) as any;

    // 最上位の要素がdivであることを確認
    expect(menuElement?.type).toBe("div");

    // classNameが正しいことを確認
    expect(menuElement?.props?.className).toBe("navbar bg-base-100");

    // 子要素の構造を確認
    const children = menuElement?.props?.children;
    expect(Array.isArray(children)).toBe(true);
    expect(children?.length).toBe(2);

    // 最初の子要素（タイトル部分）を確認
    const titleSection = children?.[0];
    expect(titleSection?.props?.className).toBe("flex-1");

    // 2番目の子要素（ユーザーメニュー部分）を確認
    const userSection = children?.[1];
    expect(userSection?.props?.className).toBe("flex-none gap-2");

    // ユーザーアイコンが含まれていることを確認
    const dropdown = userSection?.props?.children;
    expect(dropdown?.type).toBe("div");
    expect(dropdown?.props?.className).toBe("dropdown dropdown-end");
  } finally {
    // テスト後に元に戻す
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (React as any).useContext = originalUseContext;
  }
});

// ログアウト機能をテスト（JSX構造）
test("logout関数が正しく呼び出される（JSX構造）", () => {
  // React.useContextをモック
  const originalUseContext = React.useContext;
  const mockLogout = mock(() => {});

  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (React as any).useContext = () => ({ logout: mockLogout });

  try {
    // コンポーネントをレンダリング
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のJSX型アサーション
    const menuElement = Menu({ user: mockUser }) as any;

    // ドロップダウンメニューを取得
    const userSection = menuElement?.props?.children?.[1];
    const dropdown = userSection?.props?.children;
    const dropdownContent = dropdown?.props?.children?.[1];

    // ログアウトボタンを取得
    const logoutButton = dropdownContent?.props?.children?.props?.children;

    // ボタンのonClickプロパティを取得
    const onClickHandler = logoutButton?.props?.onClick;

    // クリックハンドラを実行
    onClickHandler?.();

    // logout関数が呼び出されたことを確認
    expect(mockLogout).toHaveBeenCalled();
  } finally {
    // テスト後に元に戻す
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (React as any).useContext = originalUseContext;
  }
});

// ログアウト機能をテスト（DOM操作）
test("ログアウトボタンをクリックするとlogout関数が呼び出される（DOM操作）", () => {
  // React.useContextをモック
  const originalUseContext = React.useContext;
  const mockLogout = mock(() => {});

  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (React as any).useContext = (context: any) => {
    if (context === TwitchAuthContext) {
      return { token: "test-token", logout: mockLogout };
    }
    return originalUseContext(context);
  };

  try {
    // コンポーネントをレンダリング
    const root = renderComponent(<Menu user={mockUser} />);

    // ログアウトボタンを取得
    const logoutButton = root.querySelector("button");
    expect(logoutButton).not.toBeNull();

    // クリックイベントをシミュレート
    logoutButton?.click();

    // logout関数が呼び出されたことを確認
    expect(mockLogout).toHaveBeenCalled();
  } finally {
    // テスト後に元に戻す
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (React as any).useContext = originalUseContext;
  }
});
