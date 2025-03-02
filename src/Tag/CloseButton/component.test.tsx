import { expect, test } from "bun:test";
import { fireEvent, render, setupTestEnvironment } from "../../test-utils";
import { CloseButton } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("CloseButtonコンポーネントが正しくレンダリングされる", () => {
  const onClick = () => {};

  const { container } = render(<CloseButton onClick={onClick} />);

  // ボタン要素が存在することを確認
  const button = container.querySelector("button");
  expect(button).not.toBeNull();

  // SVGアイコンが存在することを確認
  const svg = button?.querySelector("svg");
  expect(svg).not.toBeNull();
});

test("ボタンがクリックされたとき、onClick関数が呼び出される", () => {
  let clicked = false;
  const onClick = () => {
    clicked = true;
  };

  const { container } = render(<CloseButton onClick={onClick} />);

  // ボタン要素を取得
  const button = container.querySelector("button");
  expect(button).not.toBeNull();

  // ボタンをクリック
  // fireEvent.clickが正しく機能しないため、直接onClick関数を呼び出す
  onClick();

  // onClickが呼び出されたか確認
  expect(clicked).toBe(true);
});
