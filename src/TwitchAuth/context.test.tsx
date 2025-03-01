import { expect, test } from "bun:test";
import React from "react";
import { renderComponent, setupTestEnvironment } from "../test-utils";
import { TwitchAuthContext } from "./context";

// テスト環境のセットアップ
setupTestEnvironment();

test("TwitchAuthContextが正しく初期化される", () => {
  // コンテキストが存在することを確認
  expect(TwitchAuthContext).toBeDefined();

  // コンテキストを使用するテスト用コンポーネント
  const TestComponent = () => {
    const authContext = React.useContext(TwitchAuthContext);
    return (
      <div>
        <span data-testid="token">{authContext.token}</span>
        <button type="button" onClick={authContext.logout}>
          Logout
        </button>
      </div>
    );
  };

  // コンポーネントをレンダリング
  const root = renderComponent(<TestComponent />);

  // デフォルト値が正しいことを確認
  const tokenElement = root.querySelector("[data-testid='token']");
  expect(tokenElement).not.toBeNull();
  expect(tokenElement?.textContent).toBe("");

  // ボタンが存在することを確認（logout関数が提供されていることを間接的に確認）
  const button = root.querySelector("button");
  expect(button).not.toBeNull();

  // ボタンをクリックしてもエラーが発生しないことを確認
  expect(() => button?.click()).not.toThrow();
});
