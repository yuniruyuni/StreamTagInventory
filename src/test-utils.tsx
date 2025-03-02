import { beforeAll, beforeEach, mock } from "bun:test";
import { Window } from "happy-dom";
import React from "react";
import { render as reactDomRender } from "react-dom";

// グローバルにDOMを設定する関数
export function setupTestEnvironment() {
  beforeAll(() => {
    const window = new Window();
    const document = window.document;

    // グローバル変数として設定（型アサーションを使用して型エラーを回避）
    // biome-ignore lint/suspicious/noExplicitAny: テスト環境のセットアップに必要
    (global as any).window = window;
    // biome-ignore lint/suspicious/noExplicitAny: テスト環境のセットアップに必要
    (global as any).document = document;
  });

  beforeEach(() => {
    // 各テスト前にrootエレメントをリセット
    document.body.innerHTML = '<div id="root"></div>';
  });
}

// コンポーネントをレンダリングするヘルパー関数
export function render(component: React.ReactElement) {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }
  reactDomRender(component, root);
  return {
    container: root,
    getByPlaceholderText: (text: string) => {
      const elements = root.querySelectorAll(`[placeholder="${text}"]`);
      if (elements.length === 0) {
        throw new Error(`No element found with placeholder: ${text}`);
      }
      return elements[0] as HTMLElement;
    },
  };
}

// イベントをシミュレートするヘルパー関数
export const fireEvent = {
  focus: (element: HTMLElement) => {
    element.focus();
  },
  blur: (element: HTMLElement) => {
    element.blur();
  },
  change: (element: HTMLElement, options: { target: { value: string } }) => {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (element as any).value = options.target.value;
    const event = new Event("change", { bubbles: true });
    element.dispatchEvent(event);
  },
  click: (element: HTMLElement) => {
    const event = new Event("click", { bubbles: true });
    element.dispatchEvent(event);
  },
  mouseDown: (element: HTMLElement) => {
    const event = new Event("mousedown", { bubbles: true });
    element.dispatchEvent(event);
  },
};

// JSXの型定義をエクスポート
export { React, mock };
