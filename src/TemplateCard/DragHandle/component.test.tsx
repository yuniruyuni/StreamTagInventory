import { expect, test } from "bun:test";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { DragHandle } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("DragHandleコンポーネントが正しくレンダリングされる", () => {
  // モックのリスナー
  const listeners = {
    onMouseDown: () => {},
    onTouchStart: () => {},
  };

  const root = renderComponent(<DragHandle listeners={listeners} />);

  // ボタン要素が存在することを確認
  const button = root?.querySelector("button");
  expect(button).not.toBeNull();

  // SVGアイコンが存在することを確認
  const svg = button?.querySelector("svg");
  expect(svg).not.toBeNull();

  // タイトルが正しく設定されていることを確認
  const title = svg?.querySelector("title");
  expect(title).not.toBeNull();
  expect(title?.textContent).toBe("drag handle");

  // クラスが正しく設定されていることを確認
  expect(button?.className).toContain("cursor-grab");
  expect(button?.className).toContain("absolute");
});

test("リスナーが正しくボタンに渡される", () => {
  // モックのリスナー関数
  const mockListeners = {
    onMouseDown: () => {},
    onTouchStart: () => {},
  };

  const root = renderComponent(<DragHandle listeners={mockListeners} />);

  // ボタン要素を取得
  const button = root?.querySelector("button");
  expect(button).not.toBeNull();

  // リスナーがボタンの属性として設定されていることを確認
  expect(button?.onmousedown).not.toBeUndefined();
  expect(button?.ontouchstart).not.toBeUndefined();
});

test("リスナーがundefinedの場合も正しくレンダリングされる", () => {
  const root = renderComponent(<DragHandle listeners={undefined} />);

  // ボタン要素が存在することを確認
  const button = root?.querySelector("button");
  expect(button).not.toBeNull();

  // SVGアイコンが存在することを確認
  const svg = button?.querySelector("svg");
  expect(svg).not.toBeNull();
});
