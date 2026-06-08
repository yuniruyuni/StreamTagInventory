import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { DragHandle } from "./component";

const attributes = {
  role: "button",
  tabIndex: 0,
  "aria-disabled": false,
  "aria-pressed": false,
  "aria-roledescription": "sortable",
  "aria-describedby": "DndDescribedBy-0",
};

const setActivatorNodeRef = () => {};

test("DragHandleコンポーネントが正しくレンダリングされる", () => {
  // モックのリスナー
  const listeners = {
    onMouseDown: () => {},
    onTouchStart: () => {},
  };

  const { getByRole, getByTitle } = render(
    <DragHandle
      attributes={attributes}
      listeners={listeners}
      setActivatorNodeRef={setActivatorNodeRef}
    />,
  );

  // ボタン要素が存在することを確認
  const button = getByRole("button");
  expect(button).not.toBeNull();

  // SVGアイコンが存在することを確認（タイトルで特定）
  const svg = getByTitle("drag handle");
  expect(svg).not.toBeNull();

  // クラスが正しく設定されていることを確認
  expect(button).toHaveClass("cursor-grab");
  expect(button).toHaveClass("absolute");
});

test("リスナーが正しくボタンに渡される", () => {
  // モックのリスナー関数
  const mockListeners = {
    onMouseDown: () => {},
    onTouchStart: () => {},
  };

  const { getByRole } = render(
    <DragHandle
      attributes={attributes}
      listeners={mockListeners}
      setActivatorNodeRef={setActivatorNodeRef}
    />,
  );

  // ボタン要素を取得
  const button = getByRole("button");
  expect(button).not.toBeNull();

  // リスナーがボタンの属性として設定されていることを確認
  expect(button?.onmousedown).not.toBeUndefined();
  expect(button?.ontouchstart).not.toBeUndefined();
});

test("リスナーがundefinedの場合も正しくレンダリングされる", () => {
  const { getByRole, getByTitle } = render(
    <DragHandle
      attributes={attributes}
      listeners={undefined}
      setActivatorNodeRef={setActivatorNodeRef}
    />,
  );

  // ボタン要素が存在することを確認
  const button = getByRole("button");
  expect(button).not.toBeNull();

  // SVGアイコンが存在することを確認
  const svg = getByTitle("drag handle");
  expect(svg).not.toBeNull();
});
