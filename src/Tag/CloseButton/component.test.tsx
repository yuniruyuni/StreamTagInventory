import { expect, test } from "bun:test";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { CloseButton } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("CloseButtonコンポーネントが正しくレンダリングされる", () => {
  const onClick = () => {};

  const root = renderComponent(<CloseButton onClick={onClick} />);

  // ボタン要素が存在することを確認
  const button = root?.querySelector("button");
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

  const root = renderComponent(<CloseButton onClick={onClick} />);

  // ボタン要素を取得
  const button = root?.querySelector("button");
  expect(button).not.toBeNull();

  // ボタンをクリック
  button?.click();

  // onClickが呼び出されたか確認
  expect(clicked).toBe(true);
});
