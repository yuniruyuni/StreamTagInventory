import { expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { TwitchAuthContext } from "./context";

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
  const { container } = render(<TestComponent />);

  // デフォルト値が正しいことを確認
  const tokenElement = container.querySelector("[data-testid='token']");
  expect(tokenElement).not.toBeNull();
  expect(tokenElement?.textContent).toBe("");

  // ボタンが存在することを確認（logout関数が提供されていることを間接的に確認）
  const button = container.querySelector("button");
  expect(button).not.toBeNull();

  // ボタンをクリックしてもエラーが発生しないことを確認
  if (button) {
    expect(() => fireEvent.click(button)).not.toThrow();
  }
});
