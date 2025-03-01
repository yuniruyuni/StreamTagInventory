import { beforeAll, beforeEach } from "bun:test";
import { Window } from "happy-dom";
import React from "react";
import { render } from "react-dom";

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
export function renderComponent(component: React.ReactElement) {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }
  render(component, root);
  return root;
}

// JSXの型定義をエクスポート
export { React };
